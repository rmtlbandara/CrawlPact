import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import { cookieFromResponse, ctx, jsonRequest, readJson } from "./test-helpers";

/**
 * Exercises the real Paddle webhook receiver (signature verification,
 * idempotency, out-of-order protection, subscription/transaction/refund
 * handling, entitlement sync) against a real D1 database, using
 * self-generated HMAC signatures — see lib/billing/paddle-webhook.ts's
 * docstring for why real Paddle sandbox credentials weren't available to
 * verify field-name fidelity against.
 */

const WEBHOOK_SECRET = "whsec_integration_test_secret";
const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const webhookRoute = (await import("../../src/pages/api/billing/webhook")).POST;

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

async function postWebhook(
  payload: unknown,
  options: { badSignature?: boolean } = {},
): Promise<Response> {
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000);
  const signature = options.badSignature
    ? `ts=${ts};h1=${"0".repeat(64)}`
    : await signBody(body, ts);
  const request = new Request("http://x/api/billing/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Paddle-Signature": signature },
    body,
  });
  return webhookRoute(ctx(request));
}

async function signUpTestUser(displayName: string): Promise<string> {
  const beginResponse = await registerBegin(
    ctx(jsonRequest("http://x/register/begin", "POST", { displayName })),
  );
  const begin = await readJson<{
    challengeId: string;
    publicKeyCredentialCreationOptions: { challenge: string };
  }>(beginResponse);
  if (!begin.ok) throw new Error("begin failed");

  const credential = await simulateRegistration(
    await createVirtualCredential(),
    begin.data.publicKeyCredentialCreationOptions.challenge,
    RP_ID,
    ORIGIN,
  );
  const finishResponse = await registerFinish(
    ctx(
      jsonRequest("http://x/register/finish", "POST", {
        challengeId: begin.data.challengeId,
        credential,
      }),
    ),
  );
  const finish = await readJson<{ user: { id: string } }>(finishResponse);
  if (!finish.ok) throw new Error("finish failed");
  cookieFromResponse(finishResponse); // consumed only to assert a Set-Cookie header exists
  return finish.data.user.id;
}

function subscriptionPayload(fields: {
  eventId: string;
  eventType: string;
  occurredAt: string;
  status: string;
  scheduledChange?: { action: string } | null;
  periodEndsAt?: string;
}) {
  return {
    event_id: fields.eventId,
    event_type: fields.eventType,
    occurred_at: fields.occurredAt,
    data: {
      id: "sub_test_1",
      customer_id: "ctm_test_1",
      status: fields.status,
      items: [{ price: { id: "pri_pro_test" } }],
      current_billing_period: fields.periodEndsAt
        ? { starts_at: fields.occurredAt, ends_at: fields.periodEndsAt }
        : null,
      scheduled_change: fields.scheduledChange ?? null,
      custom_data: { userId: "__USER_ID__" },
    },
  };
}

describe("Paddle billing webhook (real D1, self-generated HMAC signatures)", () => {
  let db: Database;
  let dispose: () => Promise<void>;
  let userId: string;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    db = createDb(harness.db);
    mockEnv = {
      DB: harness.db,
      PUBLIC_APP_ENV: "local",
      PUBLIC_SITE_URL: ORIGIN,
      SESSION_SIGNING_SECRET: "integration-test-secret-value-long-enough",
      WEBAUTHN_RP_ID: RP_ID,
      WEBAUTHN_RP_ORIGIN: ORIGIN,
      PADDLE_API_KEY: "test",
      PADDLE_ENVIRONMENT: "sandbox",
      PADDLE_WEBHOOK_SECRET: WEBHOOK_SECRET,
      PADDLE_PRICE_ID_SOLO: "pri_solo_test",
      PADDLE_PRICE_ID_PRO: "pri_pro_test",
      PADDLE_PRICE_ID_AGENCY: "pri_agency_test",
      PUBLIC_PADDLE_CLIENT_TOKEN: "test",
      BILLING_ENABLED: "false",
      AUDIT_ENGINE_ENABLED: "false",
    };
    userId = await signUpTestUser("Ada");
  });

  afterAll(async () => {
    await dispose();
  });

  function payloadFor(fields: Parameters<typeof subscriptionPayload>[0]) {
    const p = subscriptionPayload(fields);
    (p.data.custom_data as { userId: string }).userId = userId;
    return p;
  }

  it("rejects a webhook with an invalid signature and logs a security event", async () => {
    const response = await postWebhook(
      payloadFor({
        eventId: "evt_bad_sig",
        eventType: "subscription.created",
        occurredAt: "2026-01-01T00:00:00.000000Z",
        status: "trialing",
      }),
      { badSignature: true },
    );
    expect(response.status).toBe(400);
    const body = await readJson(response);
    if (!body.ok) expect(body.error.code).toBe("BILLING_WEBHOOK_SIGNATURE_INVALID");

    const events = await db
      .select()
      .from(schema.securityEvents)
      .where(eq(schema.securityEvents.eventType, "invalid_paddle_signature"));
    expect(events.length).toBeGreaterThan(0);
  });

  it("creates a subscription (trialing) and grants the plan", async () => {
    const response = await postWebhook(
      payloadFor({
        eventId: "evt_created",
        eventType: "subscription.created",
        occurredAt: "2026-01-01T00:00:00.000000Z",
        status: "trialing",
      }),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{ outcome: string }>(response);
    if (body.ok) expect(body.data.outcome).toBe("processed");

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    expect(user!.planId).toBe("pro");

    const [sub] = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.paddleSubscriptionId, "sub_test_1"))
      .limit(1);
    expect(sub!.status).toBe("trialing");
  });

  it("updates the subscription to active on payment (renewal-style period extension)", async () => {
    const response = await postWebhook(
      payloadFor({
        eventId: "evt_active",
        eventType: "subscription.updated",
        occurredAt: "2026-01-02T00:00:00.000000Z",
        status: "active",
        periodEndsAt: "2026-02-01T00:00:00.000000Z",
      }),
    );
    expect(response.status).toBe(200);

    const [sub] = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.paddleSubscriptionId, "sub_test_1"))
      .limit(1);
    expect(sub!.status).toBe("active");
    expect(sub!.currentPeriodEnd).toBe("2026-02-01T00:00:00.000000Z");
  });

  it("does not revoke the plan while past_due (grace period)", async () => {
    const response = await postWebhook(
      payloadFor({
        eventId: "evt_past_due",
        eventType: "subscription.updated",
        occurredAt: "2026-02-02T00:00:00.000000Z",
        status: "past_due",
      }),
    );
    expect(response.status).toBe(200);

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    expect(user!.planId).toBe("pro");

    const [sub] = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.paddleSubscriptionId, "sub_test_1"))
      .limit(1);
    expect(sub!.status).toBe("past_due");
  });

  it("records a scheduled cancellation without revoking access yet", async () => {
    const response = await postWebhook(
      payloadFor({
        eventId: "evt_scheduled_cancel",
        eventType: "subscription.updated",
        occurredAt: "2026-02-03T00:00:00.000000Z",
        status: "active",
        scheduledChange: { action: "cancel" },
      }),
    );
    expect(response.status).toBe(200);

    const [sub] = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.paddleSubscriptionId, "sub_test_1"))
      .limit(1);
    expect(sub!.cancelAtPeriodEnd).toBe(true);
    expect(sub!.status).toBe("active");

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    expect(user!.planId).toBe("pro");
  });

  it("revokes the plan on effective cancellation", async () => {
    const response = await postWebhook(
      payloadFor({
        eventId: "evt_cancelled",
        eventType: "subscription.updated",
        occurredAt: "2026-03-01T00:00:00.000000Z",
        status: "canceled",
      }),
    );
    expect(response.status).toBe(200);

    const [sub] = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.paddleSubscriptionId, "sub_test_1"))
      .limit(1);
    expect(sub!.status).toBe("cancelled");

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    expect(user!.planId).toBe("free");
  });

  it("treats a resend of an already-processed event as a no-op duplicate", async () => {
    const response = await postWebhook(
      payloadFor({
        eventId: "evt_created",
        eventType: "subscription.created",
        occurredAt: "2026-01-01T00:00:00.000000Z",
        status: "trialing",
      }),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{ outcome: string }>(response);
    if (body.ok) expect(body.data.outcome).toBe("duplicate");

    // The account must still reflect the real (cancelled) end state, not be reverted.
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    expect(user!.planId).toBe("free");
  });

  it("ignores an out-of-order event instead of reverting to stale state", async () => {
    // This "active" event has an occurred_at *earlier* than the cancellation already applied above.
    const response = await postWebhook(
      payloadFor({
        eventId: "evt_late_arrival",
        eventType: "subscription.updated",
        occurredAt: "2026-01-15T00:00:00.000000Z",
        status: "active",
      }),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{ outcome: string }>(response);
    if (body.ok) expect(body.data.outcome).toBe("ignored_out_of_order");

    const [sub] = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.paddleSubscriptionId, "sub_test_1"))
      .limit(1);
    expect(sub!.status).toBe("cancelled");
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    expect(user!.planId).toBe("free");
  });

  it("records a completed transaction, then a refund adjustment against it", async () => {
    const txnResponse = await postWebhook({
      event_id: "evt_txn_completed",
      event_type: "transaction.completed",
      occurred_at: "2026-01-05T00:00:00.000000Z",
      data: {
        id: "txn_test_1",
        customer_id: "ctm_test_1",
        subscription_id: "sub_test_1",
        currency_code: "USD",
        status: "completed",
        details: { totals: { grand_total: "17900", tax: "0" } },
        custom_data: { userId },
      },
    });
    expect(txnResponse.status).toBe(200);

    const [txn] = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.paddleTransactionId, "txn_test_1"))
      .limit(1);
    expect(txn).toBeDefined();
    expect(txn!.grossAmountCents).toBe(17900);
    expect(txn!.refundStatus).toBeNull();

    const refundResponse = await postWebhook({
      event_id: "evt_refund",
      event_type: "adjustment.created",
      occurred_at: "2026-01-06T00:00:00.000000Z",
      data: { transaction_id: "txn_test_1", action: "refund" },
    });
    expect(refundResponse.status).toBe(200);

    const [refundedTxn] = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.paddleTransactionId, "txn_test_1"))
      .limit(1);
    expect(refundedTxn!.refundStatus).toBe("refunded");
  });

  it("acknowledges an unhandled event type with 200 rather than erroring", async () => {
    const response = await postWebhook({
      event_id: "evt_unhandled",
      event_type: "some.future.event.type",
      occurred_at: "2026-01-07T00:00:00.000000Z",
      data: {},
    });
    expect(response.status).toBe(200);
    const body = await readJson<{ outcome: string }>(response);
    if (body.ok) expect(body.data.outcome).toBe("ignored_unhandled_type");
  });
});
