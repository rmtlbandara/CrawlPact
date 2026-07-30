import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { createD1TestHarness } from "./d1-harness";
import { createFakeR2Bucket } from "./fake-r2-bucket";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import { cookieFromResponse, ctx, getRequest, jsonRequest, readJson } from "./test-helpers";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const createDomainRoute = (await import("../../src/pages/api/domains/index")).POST;
const findingsRoute = (await import("../../src/pages/api/admin/findings/index")).GET;

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

/** SRS §28.12: finding analytics, computed from real findings/scans/domains
 * rows against real D1 — including honestly reporting the one metric
 * (dismissal/dispute rate) the product cannot compute. */
describe("Super Admin finding analytics (real D1)", () => {
  let dispose: () => Promise<void>;
  let db: D1Database;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    db = harness.db;
    mockEnv = {
      DB: harness.db,
      AGENCY_LOGOS: createFakeR2Bucket(),
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

  it("aggregates findings by code/severity/crawler/preset/plan and honestly omits dismissal tracking", async () => {
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
    const adminCookie = admin.cookie;

    const owner = await signUpTestUser("Domain Owner");
    const domainResponse = await createDomainRoute(
      ctx(jsonRequest("http://x/domains", "POST", { target: "example.com" }, owner.cookie)),
    );
    const domainBody = await readJson<{ domainId: string }>(domainResponse);
    if (!domainBody.ok) throw new Error("domain create failed");

    const now = new Date().toISOString();
    const scanId = "scan_findings_test";
    await db
      .prepare(
        `INSERT INTO scans (id, domain_id, triggered_by, target_input, canonical_origin, status, preset, score_state, started_at, completed_at)
         VALUES (?, ?, 'manual', 'example.com', 'https://example.com', 'completed', 'maximum_ai_visibility', 'scored', ?, ?)`,
      )
      .bind(scanId, domainBody.data.domainId, now, now)
      .run();
    await db
      .prepare("UPDATE domains SET last_scan_id = ? WHERE id = ?")
      .bind(scanId, domainBody.data.domainId)
      .run();

    for (const [code, severity] of [
      ["search_crawler_blocked", "critical"],
      ["search_crawler_blocked", "critical"],
      ["training_crawler_allowed", "information"],
    ] as const) {
      await db
        .prepare(
          `INSERT INTO findings (id, scan_id, finding_code, severity, category, title, summary, evidence, affected_crawler_id, business_impact, recommended_action, confidence, ruleset_version_id, created_at)
           VALUES (?, ?, ?, ?, 'access', 'Test finding', 'Test summary', 'Test evidence', 'crawler_test', 'Test impact', 'Test action', 'high', 'rules_test', ?)`,
        )
        .bind(crypto.randomUUID(), scanId, code, severity, now)
        .run();
    }

    const response = await findingsRoute(
      ctx(getRequest("http://x/api/admin/findings?range=30d", adminCookie)),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{
      mostFrequent: { code: string; count: number }[];
      bySeverity: { severity: string; count: number }[];
      byCrawler: { crawlerName: string | null; count: number }[];
      byPreset: { preset: string; count: number }[];
      byPlan: { planId: string; count: number }[];
      newlyIntroduced: { code: string }[];
      dismissalTrackingAvailable: boolean;
    }>(response);
    if (!body.ok) throw new Error("findings request failed");

    expect(body.data.mostFrequent.find((f) => f.code === "search_crawler_blocked")?.count).toBe(2);
    expect(body.data.bySeverity.find((s) => s.severity === "critical")?.count).toBe(2);
    expect(body.data.byCrawler.find((c) => c.crawlerName === "TestBot")?.count).toBe(3);
    expect(body.data.byPreset.find((p) => p.preset === "maximum_ai_visibility")?.count).toBe(3);
    expect(body.data.byPlan.find((p) => p.planId === "free")?.count).toBe(3);
    expect(body.data.newlyIntroduced.some((n) => n.code === "search_crawler_blocked")).toBe(true);
    expect(body.data.dismissalTrackingAvailable).toBe(false);
  });

  it("rejects a non-admin from the finding analytics route", async () => {
    const normal = await signUpTestUser("Bystander");
    const response = await findingsRoute(
      ctx(getRequest("http://x/api/admin/findings", normal.cookie)),
    );
    expect(response.status).toBe(403);
  });
});
