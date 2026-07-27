import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { createD1TestHarness } from "./d1-harness";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import { cookieFromResponse, ctx, getRequest, jsonRequest, readJson } from "./test-helpers";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const securityRoute = (await import("../../src/pages/api/admin/security/index")).GET;
const resolveRoute = (await import("../../src/pages/api/admin/security/[eventId]/resolve")).POST;

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

/** SRS §28.14: security dashboard + event resolution, against real D1. */
describe("Super Admin security operations (real D1)", () => {
  let dispose: () => Promise<void>;
  let db: D1Database;

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
  let eventId: number;

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

    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO security_events (event_type, target, details, created_at) VALUES ('unsafe_scan_attempt', 'malicious.invalid', '{}', ?)",
      )
      .bind(now)
      .run();
    const row = await db.prepare("SELECT id FROM security_events ORDER BY id DESC LIMIT 1").first();
    eventId = (row as { id: number }).id;
  });

  it("lists security events filterable by type and unresolved status", async () => {
    const response = await securityRoute(
      ctx(
        getRequest(
          "http://x/api/admin/security?eventType=unsafe_scan_attempt&unresolvedOnly=true",
          adminCookie,
        ),
      ),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{ events: { event: { id: number; resolvedAt: string | null } }[] }>(
      response,
    );
    if (!body.ok) throw new Error("list failed");
    expect(
      body.data.events.some((e) => e.event.id === eventId && e.event.resolvedAt === null),
    ).toBe(true);
  });

  it("rejects resolving without a note", async () => {
    const response = await resolveRoute(
      ctx(jsonRequest(`http://x/api/admin/security/${eventId}/resolve`, "POST", {}, adminCookie), {
        eventId: String(eventId),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("resolves a security event, recorded in the audit log", async () => {
    const response = await resolveRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/security/${eventId}/resolve`,
          "POST",
          { note: "Confirmed a false positive after reviewing the target." },
          adminCookie,
        ),
        { eventId: String(eventId) },
      ),
    );
    expect(response.status).toBe(200);

    const row = await db
      .prepare("SELECT resolved_at, resolution_note FROM security_events WHERE id = ?")
      .bind(eventId)
      .first();
    expect((row as { resolved_at: string | null }).resolved_at).not.toBeNull();
    expect((row as { resolution_note: string }).resolution_note).toBe(
      "Confirmed a false positive after reviewing the target.",
    );

    const auditRow = await db
      .prepare("SELECT * FROM admin_audit_logs WHERE action = 'security_event.resolve'")
      .first();
    expect(auditRow).toBeTruthy();
  });

  it("rejects a non-admin from the security dashboard", async () => {
    const normal = await signUpTestUser("Bystander");
    const response = await securityRoute(
      ctx(getRequest("http://x/api/admin/security", normal.cookie)),
    );
    expect(response.status).toBe(403);
  });
});
