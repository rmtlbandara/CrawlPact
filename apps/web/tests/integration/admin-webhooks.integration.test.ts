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
const webhookRoute = (await import("../../src/pages/api/billing/webhook")).POST;
const listWebhooksRoute = (await import("../../src/pages/api/admin/webhooks/index")).GET;
const retryRoute = (await import("../../src/pages/api/admin/webhooks/[webhookEventId]/retry")).POST;

const WEBHOOK_SECRET = "whsec_integration_test_secret";
const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

async function signBody(body: string, ts: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${ts}:${body}`),
  );
  const hex = Array.from(new Uint8Array(signatureBytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return `ts=${ts};h1=${hex}`;
}

async function postWebhook(payload: unknown): Promise<Response> {
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000);
  const signature = await signBody(body, ts);
  const request = new Request("http://x/api/billing/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Paddle-Signature": signature },
    body,
  });
  return webhookRoute(ctx(request));
}

/** SRS §28.7: webhook operations dashboard and safe, idempotent retry, against real D1. */
describe("Super Admin webhook operations (real D1)", () => {
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
      PADDLE_WEBHOOK_SECRET: WEBHOOK_SECRET,
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
    await db
      .prepare("UPDATE sessions SET is_admin_session = 1 WHERE user_id = ?")
      .bind(admin.userId)
      .run();
    adminCookie = admin.cookie;

    const target = await signUpTestUser("Target Customer");
    targetUserId = target.userId;
  });

  let failedWebhookEventId: string;

  it("stores a subscription webhook as failed when no billing-customer linkage exists and no custom_data is present", async () => {
    const response = await postWebhook({
      event_id: "evt_orphan_1",
      event_type: "subscription.created",
      occurred_at: new Date().toISOString(),
      data: {
        id: "sub_orphan_1",
        customer_id: "ctm_orphan_1",
        status: "active",
        items: [{ price: { id: "pri_test_solo_month" } }],
        current_billing_period: { ends_at: new Date(Date.now() + 365 * 86400_000).toISOString() },
      },
    });
    expect(response.status).toBe(200);

    const row = await db
      .prepare("SELECT id, status FROM webhook_events WHERE paddle_event_id = 'evt_orphan_1'")
      .first();
    expect((row as { status: string }).status).toBe("failed");
    failedWebhookEventId = (row as { id: string }).id;
  });

  it("lists the failed webhook via the admin dashboard", async () => {
    const response = await listWebhooksRoute(
      ctx(getRequest("http://x/api/admin/webhooks?status=failed", adminCookie)),
    );
    const body = await readJson<{ id: string; status: string }[]>(response);
    if (!body.ok) throw new Error("list failed");
    expect(body.data.some((r) => r.id === failedWebhookEventId)).toBe(true);
  });

  it("retrying without a reason is rejected", async () => {
    const response = await retryRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/webhooks/${failedWebhookEventId}/retry`,
          "POST",
          {},
          adminCookie,
        ),
        { webhookEventId: failedWebhookEventId },
      ),
    );
    expect(response.status).toBe(400);
  });

  it("retry still fails while the underlying linkage is missing (honest, not fabricated)", async () => {
    const response = await retryRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/webhooks/${failedWebhookEventId}/retry`,
          "POST",
          { reason: "Investigating orphaned subscription webhook" },
          adminCookie,
        ),
        { webhookEventId: failedWebhookEventId },
      ),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{ outcome: string }>(response);
    if (!body.ok) throw new Error("retry request failed");
    expect(body.data.outcome).toBe("failed");
  });

  it("succeeds once the billing-customer linkage is established out-of-band, then retried", async () => {
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO billing_customers (id, user_id, paddle_customer_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind("bc_orphan_1", targetUserId, "ctm_orphan_1", now, now)
      .run();

    const response = await retryRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/webhooks/${failedWebhookEventId}/retry`,
          "POST",
          { reason: "Linkage established, retrying" },
          adminCookie,
        ),
        { webhookEventId: failedWebhookEventId },
      ),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{ outcome: string }>(response);
    if (!body.ok) throw new Error("retry request failed");
    expect(body.data.outcome).toBe("processed");

    const sub = await db
      .prepare(
        "SELECT plan_id, status FROM subscriptions WHERE paddle_subscription_id = 'sub_orphan_1'",
      )
      .first();
    expect((sub as { plan_id: string }).plan_id).toBe("solo");
    expect((sub as { status: string }).status).toBe("active");
  });

  it("refuses to retry an already-processed event", async () => {
    const response = await retryRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/webhooks/${failedWebhookEventId}/retry`,
          "POST",
          { reason: "trying to double-process" },
          adminCookie,
        ),
        { webhookEventId: failedWebhookEventId },
      ),
    );
    expect(response.status).toBe(400);
    const body = await readJson(response);
    if (body.ok) throw new Error("expected rejection");
    expect(body.error.message).toContain("eligible");
  });

  it("rejects a non-admin from the webhook operations routes", async () => {
    const normal = await signUpTestUser("Bystander");
    const response = await listWebhooksRoute(
      ctx(getRequest("http://x/api/admin/webhooks", normal.cookie)),
    );
    expect(response.status).toBe(403);
  });
});
