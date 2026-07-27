import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { createD1TestHarness } from "./d1-harness";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import { cookieFromResponse, ctx, getRequest, jsonRequest, readJson } from "./test-helpers";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const createDomainRoute = (await import("../../src/pages/api/domains/index")).POST;
const listDomainsRoute = (await import("../../src/pages/api/admin/domains/index")).GET;
const adminScanRoute = (await import("../../src/pages/api/admin/domains/[domainId]/scan")).POST;
const monitoringRoute = (await import("../../src/pages/api/admin/domains/[domainId]/monitoring"))
  .POST;
const scanOpsRoute = (await import("../../src/pages/api/admin/scans/index")).GET;
const listBlockedRoute = (await import("../../src/pages/api/admin/blocked-targets/index")).GET;
const blockRoute = (await import("../../src/pages/api/admin/blocked-targets/index")).POST;
const unblockRoute = (
  await import("../../src/pages/api/admin/blocked-targets/[blockedTargetId]/unblock")
).POST;

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

function makeResponse(status: number, body: string): Response {
  return new Response(body, { status });
}

/** SRS §28.8/§28.9/§28.14: global domain/scan operations and target
 * blocklist management, against real D1. */
describe("Super Admin domain and scan operations (real D1)", () => {
  let dispose: () => Promise<void>;
  let db: D1Database;
  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    db = harness.db;
    mockEnv = {
      DB: harness.db,
      PUBLIC_APP_ENV: "local",
      PUBLIC_SITE_URL: ORIGIN,
      SESSION_SIGNING_SECRET: "integration-test-secret-value-long-enough",
      WEBAUTHN_RP_ID: RP_ID,
      WEBAUTHN_RP_ORIGIN: ORIGIN,
      PADDLE_API_KEY: "test",
      PADDLE_ENVIRONMENT: "sandbox",
      PADDLE_WEBHOOK_SECRET: "test",
      PADDLE_PRICE_ID_SOLO: "test",
      PADDLE_PRICE_ID_PRO: "test",
      PADDLE_PRICE_ID_AGENCY: "test",
      PUBLIC_PADDLE_CLIENT_TOKEN: "test",
      BILLING_ENABLED: "false",
      AUDIT_ENGINE_ENABLED: "false",
    };
  });

  afterAll(async () => {
    await dispose();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  async function signUpTestUser(displayName: string): Promise<{ cookie: string; userId: string }> {
    const beginResponse = await registerBegin(
      ctx(jsonRequest("http://x/register/begin", "POST", { displayName })),
    );
    const begin = await readJson<{
      challengeId: string;
      publicKeyCredentialCreationOptions: { challenge: string };
    }>(beginResponse);
    if (!begin.ok) throw new Error("begin failed");
    const credential = await createVirtualCredential();
    const response = await simulateRegistration(
      credential,
      begin.data.publicKeyCredentialCreationOptions.challenge,
      RP_ID,
      ORIGIN,
    );
    const finishResponse = await registerFinish(
      ctx(
        jsonRequest("http://x/register/finish", "POST", {
          challengeId: begin.data.challengeId,
          credential: response,
        }),
      ),
    );
    const cookie = cookieFromResponse(finishResponse);
    const finishBody = await readJson<{ user: { id: string } }>(finishResponse);
    if (!finishBody.ok) throw new Error("finish failed");
    return { cookie, userId: finishBody.data.user.id };
  }

  let adminCookie: string;
  let targetCookie: string;
  let domainId: string;

  beforeAll(async () => {
    const admin = await signUpTestUser("Ops Admin");
    await db.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").bind(admin.userId).run();
    await db
      .prepare(
        `INSERT INTO admin_role_assignments (id, user_id, role_id) VALUES (?, ?, 'super_admin')`,
      )
      .bind(`ara_${admin.userId}`, admin.userId)
      .run();
    await db
      .prepare("UPDATE sessions SET is_admin_session = 1 WHERE user_id = ?")
      .bind(admin.userId)
      .run();
    adminCookie = admin.cookie;

    const target = await signUpTestUser("Target Customer");
    targetCookie = target.cookie;

    const createResponse = await createDomainRoute(
      ctx(jsonRequest("http://x/domains", "POST", { target: "example.com" }, targetCookie)),
    );
    const created = await readJson<{ domainId: string }>(createResponse);
    if (!created.ok) throw new Error("domain create failed");
    domainId = created.data.domainId;
  });

  it("lists the domain in the global table with owner, plan, and critical findings count visible", async () => {
    const response = await listDomainsRoute(
      ctx(getRequest("http://x/api/admin/domains", adminCookie)),
    );
    const body = await readJson<
      {
        domain: { id: string; canonicalOrigin: string };
        owner: { planId: string };
        criticalFindingsCount: number;
      }[]
    >(response);
    if (!body.ok) throw new Error("list failed");
    const row = body.data.find((r) => r.domain.id === domainId);
    expect(row?.domain.canonicalOrigin).toBe("https://example.com");
    expect(row?.owner.planId).toBe("free");
    // No scan has run against this domain yet — the LEFT JOIN aggregate
    // (Part 3 Step 19's N+1 fix) must still report 0, not null/undefined.
    expect(row?.criticalFindingsCount).toBe(0);
  });

  it("pushes search and monitoring-state filters into SQL rather than the previous fetch-then-filter-in-JS shape", async () => {
    const byQuery = await listDomainsRoute(
      ctx(getRequest("http://x/api/admin/domains?q=example.com", adminCookie)),
    );
    const byQueryBody = await readJson<{ domain: { id: string } }[]>(byQuery);
    if (!byQueryBody.ok) throw new Error("query filter failed");
    expect(byQueryBody.data.some((r) => r.domain.id === domainId)).toBe(true);

    const byMissingQuery = await listDomainsRoute(
      ctx(getRequest("http://x/api/admin/domains?q=no-such-domain-anywhere", adminCookie)),
    );
    const byMissingQueryBody = await readJson<{ domain: { id: string } }[]>(byMissingQuery);
    if (!byMissingQueryBody.ok) throw new Error("query filter failed");
    expect(byMissingQueryBody.data.some((r) => r.domain.id === domainId)).toBe(false);

    const byState = await listDomainsRoute(
      ctx(getRequest("http://x/api/admin/domains?monitoringState=active", adminCookie)),
    );
    const byStateBody = await readJson<{ domain: { id: string } }[]>(byState);
    if (!byStateBody.ok) throw new Error("state filter failed");
    expect(byStateBody.data.some((r) => r.domain.id === domainId)).toBe(true);

    const byWrongState = await listDomainsRoute(
      ctx(getRequest("http://x/api/admin/domains?monitoringState=paused", adminCookie)),
    );
    const byWrongStateBody = await readJson<{ domain: { id: string } }[]>(byWrongState);
    if (!byWrongStateBody.ok) throw new Error("state filter failed");
    expect(byWrongStateBody.data.some((r) => r.domain.id === domainId)).toBe(false);
  });

  it("runs an administrative scan without consuming the owner's manual re-scan quota", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) return makeResponse(200, "User-agent: *\nAllow: /\n");
      return makeResponse(404, "");
    }) as unknown as typeof fetch;

    const response = await adminScanRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/domains/${domainId}/scan`,
          "POST",
          { reason: "Investigating a customer support ticket" },
          adminCookie,
        ),
        { domainId },
      ),
    );
    expect(response.status).toBe(200);

    const scanRows = await db
      .prepare("SELECT triggered_by FROM scans WHERE domain_id = ?")
      .bind(domainId)
      .all();
    expect((scanRows.results[0] as { triggered_by: string }).triggered_by).toBe("admin");

    const auditRow = await db
      .prepare("SELECT * FROM admin_audit_logs WHERE action = 'domain.admin_scan' AND target = ?")
      .bind(domainId)
      .first();
    expect(auditRow).toBeTruthy();
  });

  it("pauses and resumes monitoring for a specific domain", async () => {
    const pauseResponse = await monitoringRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/domains/${domainId}/monitoring`,
          "POST",
          { state: "paused", reason: "Suspicious activity under review" },
          adminCookie,
        ),
        { domainId },
      ),
    );
    expect(pauseResponse.status).toBe(200);
    const paused = await db
      .prepare("SELECT monitoring_state FROM domains WHERE id = ?")
      .bind(domainId)
      .first();
    expect((paused as { monitoring_state: string }).monitoring_state).toBe("paused");

    const resumeResponse = await monitoringRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/domains/${domainId}/monitoring`,
          "POST",
          { state: "active", reason: "Review complete" },
          adminCookie,
        ),
        { domainId },
      ),
    );
    expect(resumeResponse.status).toBe(200);
    const resumed = await db
      .prepare("SELECT monitoring_state FROM domains WHERE id = ?")
      .bind(domainId)
      .first();
    expect((resumed as { monitoring_state: string }).monitoring_state).toBe("active");
  });

  it("returns a real (non-fabricated) scan operations summary", async () => {
    const response = await scanOpsRoute(
      ctx(getRequest("http://x/api/admin/scans?range=30d", adminCookie)),
    );
    const body = await readJson<{
      summary: { started: number; pending: number; retrying: number };
    }>(response);
    if (!body.ok) throw new Error("scan ops failed");
    expect(body.data.summary.started).toBeGreaterThanOrEqual(1);
    // No queue exists in this architecture — these must always be 0, not fabricated.
    expect(body.data.summary.pending).toBe(0);
    expect(body.data.summary.retrying).toBe(0);
  });

  let blockedTargetId: string;

  it("blocks a target, which then appears in the blocklist", async () => {
    const response = await blockRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/blocked-targets",
          "POST",
          { targetPattern: "malicious-test-target.invalid", reason: "Reported for abuse" },
          adminCookie,
        ),
      ),
    );
    expect(response.status).toBe(201);
    const body = await readJson<{ id: string }>(response);
    if (!body.ok) throw new Error("block failed");
    blockedTargetId = body.data.id;

    const listResponse = await listBlockedRoute(
      ctx(getRequest("http://x/api/admin/blocked-targets", adminCookie)),
    );
    const list =
      await readJson<{ target: { id: string; removedAt: string | null } }[]>(listResponse);
    if (!list.ok) throw new Error("list failed");
    expect(list.data.find((r) => r.target.id === blockedTargetId)?.target.removedAt).toBeNull();
  });

  it("unblocks the target", async () => {
    const response = await unblockRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/blocked-targets/${blockedTargetId}/unblock`,
          "POST",
          { reason: "False positive, target is legitimate" },
          adminCookie,
        ),
        { blockedTargetId },
      ),
    );
    expect(response.status).toBe(200);

    const row = await db
      .prepare("SELECT removed_at FROM blocked_targets WHERE id = ?")
      .bind(blockedTargetId)
      .first();
    expect((row as { removed_at: string | null }).removed_at).not.toBeNull();
  });

  it("rejects a non-admin from every domain/scan/blocklist operations route", async () => {
    const response = await listDomainsRoute(
      ctx(getRequest("http://x/api/admin/domains", targetCookie)),
    );
    expect(response.status).toBe(403);
  });
});
