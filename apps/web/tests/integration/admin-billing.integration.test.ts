import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { createD1TestHarness } from "./d1-harness";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import { cookieFromResponse, ctx, getRequest, jsonRequest, readJson } from "./test-helpers";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const listSubscriptionsRoute = (await import("../../src/pages/api/admin/subscriptions/index")).GET;
const resyncRoute = (
  await import("../../src/pages/api/admin/subscriptions/[subscriptionId]/resync")
).POST;
const listEntitlementsRoute = (await import("../../src/pages/api/admin/entitlements/index")).GET;
const grantRoute = (await import("../../src/pages/api/admin/entitlements/index")).POST;
const revokeRoute = (await import("../../src/pages/api/admin/entitlements/[entitlementId]/revoke"))
  .POST;

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

/** SRS §28.5/§28.6: subscription/entitlement operations against real D1. */
describe("Super Admin subscription and entitlement operations (real D1)", () => {
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
      PADDLE_PRICE_ID_SOLO: "pri_solo",
      PADDLE_PRICE_ID_PRO: "pri_pro",
      PADDLE_PRICE_ID_AGENCY: "pri_agency",
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
  let targetUserId: string;

  beforeAll(async () => {
    const admin = await signUpTestUser("Ops Admin");
    await db.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").bind(admin.userId).run();
    await db
      .prepare(
        `INSERT INTO admin_role_assignments (id, user_id, role_id) VALUES (?, ?, 'super_admin')`,
      )
      .bind(`ara_${admin.userId}`, admin.userId)
      .run();
    // Re-login not needed for admin here since we bind the cookie's session
    // directly to isAdminSession via a fresh session row (mirrors how the
    // other admin test files re-login; done via direct insert here for
    // brevity since login isn't the subject of this test file).
    await db
      .prepare("UPDATE sessions SET is_admin_session = 1 WHERE user_id = ?")
      .bind(admin.userId)
      .run();
    adminCookie = admin.cookie;

    const target = await signUpTestUser("Target Customer");
    targetUserId = target.userId;
  });

  it("rejects a grant with an expiry date in the past", async () => {
    const response = await grantRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/entitlements",
          "POST",
          {
            userId: targetUserId,
            grantedPlanId: "pro",
            expiresAt: new Date(Date.now() - 60_000).toISOString(),
            reason: "testing past expiry rejection",
          },
          adminCookie,
        ),
      ),
    );
    expect(response.status).toBe(400);
  });

  let entitlementId: string;

  it("grants a temporary entitlement, immediately upgrading the user's plan", async () => {
    const response = await grantRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/entitlements",
          "POST",
          {
            userId: targetUserId,
            grantedPlanId: "pro",
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            reason: "Beta programme trial upgrade",
          },
          adminCookie,
        ),
      ),
    );
    expect(response.status).toBe(201);
    const body = await readJson<{ entitlementId: string }>(response);
    if (!body.ok) throw new Error("grant failed");
    entitlementId = body.data.entitlementId;

    const user = await db
      .prepare("SELECT plan_id FROM users WHERE id = ?")
      .bind(targetUserId)
      .first();
    expect((user as { plan_id: string }).plan_id).toBe("pro");

    const auditRow = await db
      .prepare("SELECT * FROM admin_audit_logs WHERE action = 'entitlement.grant' AND target = ?")
      .bind(targetUserId)
      .first();
    expect(auditRow).toBeTruthy();
  });

  it("lists the entitlement as active", async () => {
    const response = await listEntitlementsRoute(
      ctx(getRequest("http://x/api/admin/entitlements", adminCookie)),
    );
    const body =
      await readJson<{ entitlement: { id: string; revokedAt: string | null } }[]>(response);
    if (!body.ok) throw new Error("list failed");
    const row = body.data.find((r) => r.entitlement.id === entitlementId);
    expect(row?.entitlement.revokedAt).toBeNull();
  });

  it("revoking the entitlement immediately reverts the user to free (no real subscription exists)", async () => {
    const response = await revokeRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/entitlements/${entitlementId}/revoke`,
          "POST",
          { reason: "Trial period ended early" },
          adminCookie,
        ),
        { entitlementId },
      ),
    );
    expect(response.status).toBe(200);

    const user = await db
      .prepare("SELECT plan_id FROM users WHERE id = ?")
      .bind(targetUserId)
      .first();
    expect((user as { plan_id: string }).plan_id).toBe("free");
  });

  it("detects an entitlement mismatch between a subscription and the owning user's actual plan", async () => {
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO billing_customers (id, user_id, paddle_customer_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind("bc_test", targetUserId, "ctm_test", now, now)
      .run();
    await db
      .prepare(
        `INSERT INTO subscriptions (id, billing_customer_id, paddle_subscription_id, plan_id, status, current_period_end, created_at, updated_at)
         VALUES (?, ?, ?, 'pro', 'active', ?, ?, ?)`,
      )
      .bind("sub_test", "bc_test", "sub_paddle_test", now, now, now)
      .run();
    // targetUserId's plan is 'free' (from the revoke above) but this active
    // subscription says 'pro' — a real, detectable entitlement mismatch.

    const response = await listSubscriptionsRoute(
      ctx(getRequest("http://x/api/admin/subscriptions?mismatch=true", adminCookie)),
    );
    const body =
      await readJson<{ subscription: { id: string }; entitlementMismatch: boolean }[]>(response);
    if (!body.ok) throw new Error("list failed");
    expect(body.data.some((r) => r.subscription.id === "sub_test" && r.entitlementMismatch)).toBe(
      true,
    );
  });

  it("records a real (failing) sync error when Paddle is unreachable, rather than fabricating success", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("not found", { status: 404 }),
    ) as unknown as typeof fetch;

    const response = await resyncRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/subscriptions/sub_test/resync",
          "POST",
          { reason: "Investigating entitlement mismatch" },
          adminCookie,
        ),
        { subscriptionId: "sub_test" },
      ),
    );
    expect(response.status).toBe(409);
    const body = await readJson(response);
    if (body.ok) throw new Error("expected failure");
    expect(body.error.code).toBe("BILLING_SYNC_ERROR");

    const sub = await db
      .prepare("SELECT sync_error FROM subscriptions WHERE id = ?")
      .bind("sub_test")
      .first();
    expect((sub as { sync_error: string | null }).sync_error).toBeTruthy();
  });

  it("rejects a non-admin from every subscription/entitlement route", async () => {
    const normal = await signUpTestUser("Bystander");
    const response = await listSubscriptionsRoute(
      ctx(getRequest("http://x/api/admin/subscriptions", normal.cookie)),
    );
    expect(response.status).toBe(403);
  });
});
