import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { createFakeR2Bucket } from "./fake-r2-bucket";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import { cookieFromResponse, ctx, jsonRequest, readJson } from "./test-helpers";

/**
 * Exercises the real checkout price-resolution and plan-change endpoints (Phase 6) against a real
 * D1 database: server-side price validation (never trusting a client-supplied price ID/amount —
 * see docs/security/PHASE_06_BILLING_AND_CHECKOUT_THREAT_REVIEW.md), the immediate/scheduled
 * plan-change direction rule, and that neither endpoint ever writes `users.plan_id` directly
 * (only a verified webhook may — see apps/web/src/pages/api/billing/AGENTS.md).
 */

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const checkoutRoute = (await import("../../src/pages/api/billing/checkout")).POST;
const previewRoute = (await import("../../src/pages/api/billing/plan-change/preview")).POST;
const confirmRoute = (await import("../../src/pages/api/billing/plan-change/confirm")).POST;
const cancelScheduledRoute = (
  await import("../../src/pages/api/billing/plan-change/cancel-scheduled")
).POST;

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

describe("Checkout price resolution (real D1)", () => {
  let dispose: () => Promise<void>;
  let cookie: string;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
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
      PADDLE_PRICE_ID_SOLO: "pri_solo_test",
      PADDLE_PRICE_ID_PRO: "pri_pro_test",
      PADDLE_PRICE_ID_AGENCY: "pri_agency_test",
      PUBLIC_PADDLE_CLIENT_TOKEN: "test",
      BILLING_ENABLED: "true",
      AUDIT_ENGINE_ENABLED: "false",
    };
    const user = await signUpTestUser("Checkout Customer");
    cookie = user.cookie;
  });

  afterAll(async () => {
    await dispose();
  });

  it("resolves the current (non-legacy) active price for a valid plan/interval", async () => {
    const response = await checkoutRoute(
      ctx(
        jsonRequest(
          "http://x/api/billing/checkout",
          "POST",
          { planId: "solo", interval: "year" },
          cookie,
        ),
      ),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{ priceId: string; customData: { userId: string } }>(response);
    if (!body.ok) throw new Error("expected success");
    // Never the legacy solo/year price ("pri_test_solo_year_legacy", seeded alongside this one)
    // — resolveCheckoutPrice must only ever return the active-for-new-checkout row.
    expect(body.data.priceId).toBe("pri_test_solo_year");
  });

  it("never trusts a client-supplied price ID or amount — the request schema has no such field", async () => {
    const response = await checkoutRoute(
      ctx(
        jsonRequest(
          "http://x/api/billing/checkout",
          "POST",
          // A client attempting to smuggle a price/amount through extra fields — Zod's schema
          // only reads planId/interval, so these are silently ignored, not honoured.
          {
            planId: "solo",
            interval: "month",
            priceId: "pri_attacker_supplied",
            amount: 1,
          },
          cookie,
        ),
      ),
    );
    const body = await readJson<{ priceId: string }>(response);
    if (!body.ok) throw new Error("expected success");
    expect(body.data.priceId).toBe("pri_test_solo_month");
  });

  it("rejects a checkout request for the free plan", async () => {
    const response = await checkoutRoute(
      ctx(
        jsonRequest(
          "http://x/api/billing/checkout",
          "POST",
          { planId: "free", interval: "month" },
          cookie,
        ),
      ),
    );
    expect(response.status).toBe(400);
  });

  it("rejects an invalid billing interval", async () => {
    const response = await checkoutRoute(
      ctx(
        jsonRequest(
          "http://x/api/billing/checkout",
          "POST",
          { planId: "solo", interval: "century" },
          cookie,
        ),
      ),
    );
    expect(response.status).toBe(400);
  });

  it("requires authentication", async () => {
    const response = await checkoutRoute(
      ctx(
        jsonRequest("http://x/api/billing/checkout", "POST", {
          planId: "solo",
          interval: "month",
        }),
      ),
    );
    expect(response.status).toBe(401);
  });

  it("rejects a cross-origin request (CSRF defence-in-depth)", async () => {
    const request = new Request("http://x/api/billing/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.example",
        Cookie: cookie,
      },
      body: JSON.stringify({ planId: "solo", interval: "month" }),
    });
    const response = await checkoutRoute(ctx(request));
    expect(response.status).toBe(403);
  });
});

describe("Plan change: immediate upgrade and scheduled downgrade (real D1)", () => {
  let dispose: () => Promise<void>;
  let db: Database;
  let cookie: string;
  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    db = createDb(harness.db);
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
      PADDLE_PRICE_ID_SOLO: "pri_solo_test",
      PADDLE_PRICE_ID_PRO: "pri_pro_test",
      PADDLE_PRICE_ID_AGENCY: "pri_agency_test",
      PUBLIC_PADDLE_CLIENT_TOKEN: "test",
      BILLING_ENABLED: "true",
      AUDIT_ENGINE_ENABLED: "false",
    };
    const user = await signUpTestUser("Plan Change Customer");
    cookie = user.cookie;

    // An existing Pro/month subscriber, set up directly (mirrors admin-billing.integration's own
    // pattern) — this test suite covers the plan-change endpoints, not webhook-driven creation.
    const now = new Date().toISOString();
    await db.insert(schema.billingCustomers).values({
      id: "bc_plan_change",
      userId: user.userId,
      paddleCustomerId: "ctm_plan_change",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.subscriptions).values({
      id: "sub_plan_change",
      billingCustomerId: "bc_plan_change",
      paddleSubscriptionId: "sub_paddle_plan_change",
      planId: "pro",
      status: "active",
      currentPeriodEnd: "2026-09-01T00:00:00.000Z",
      paddlePriceId: "pri_test_pro_month",
      billingInterval: "month",
      createdAt: now,
      updatedAt: now,
    });
  });

  afterAll(async () => {
    await dispose();
  });

  it("rejects a plan-change request for the caller's own current plan/interval", async () => {
    const response = await confirmRoute(
      ctx(
        jsonRequest(
          "http://x/api/billing/plan-change/confirm",
          "POST",
          { planId: "pro", interval: "month" },
          cookie,
        ),
      ),
    );
    expect(response.status).toBe(400);
  });

  it("rejects a plan-change request from a caller with no active subscription", async () => {
    const other = await signUpTestUser("No Subscription Customer");
    const response = await previewRoute(
      ctx(
        jsonRequest(
          "http://x/api/billing/plan-change/preview",
          "POST",
          { planId: "solo", interval: "month" },
          other.cookie,
        ),
      ),
    );
    expect(response.status).toBe(400);
  });

  it("previews and confirms an immediate upgrade using Paddle's real proration figures, never crediting the entitlement locally", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/preview")) {
        return new Response(
          JSON.stringify({
            data: {
              currency_code: "USD",
              next_billed_at: "2026-09-01T00:00:00.000Z",
              immediate_transaction: { details: { totals: { grand_total: "1234" } } },
            },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ data: { id: "sub_paddle_plan_change" } }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const previewResponse = await previewRoute(
      ctx(
        jsonRequest(
          "http://x/api/billing/plan-change/preview",
          "POST",
          { planId: "agency", interval: "month" },
          cookie,
        ),
      ),
    );
    expect(previewResponse.status).toBe(200);
    const previewBody = await readJson<{
      direction: string;
      immediateTotalCents: number | null;
    }>(previewResponse);
    if (!previewBody.ok) throw new Error("expected success");
    expect(previewBody.data.direction).toBe("immediate");
    expect(previewBody.data.immediateTotalCents).toBe(1234);

    const confirmResponse = await confirmRoute(
      ctx(
        jsonRequest(
          "http://x/api/billing/plan-change/confirm",
          "POST",
          { planId: "agency", interval: "month" },
          cookie,
        ),
      ),
    );
    expect(confirmResponse.status).toBe(200);
    const confirmBody = await readJson<{ direction: string }>(confirmResponse);
    if (!confirmBody.ok) throw new Error("expected success");
    expect(confirmBody.data.direction).toBe("immediate");

    // Never grants the entitlement directly — only a verified webhook may.
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.displayName, "Plan Change Customer"))
      .limit(1);
    expect(user!.planId).toBe("free"); // unchanged since sign-up; this test never ran a webhook
    const [sub] = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.id, "sub_plan_change"))
      .limit(1);
    expect(sub!.planId).toBe("pro"); // still the pre-change value — confirm never writes this
  });

  it("confirms a downgrade as scheduled, never calling Paddle, preserving current entitlements until the effective date", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const confirmResponse = await confirmRoute(
      ctx(
        jsonRequest(
          "http://x/api/billing/plan-change/confirm",
          "POST",
          { planId: "solo", interval: "month" },
          cookie,
        ),
      ),
    );
    expect(confirmResponse.status).toBe(200);
    const confirmBody = await readJson<{ direction: string; effectiveDate: string | null }>(
      confirmResponse,
    );
    if (!confirmBody.ok) throw new Error("expected success");
    expect(confirmBody.data.direction).toBe("scheduled");
    expect(confirmBody.data.effectiveDate).toBe("2026-09-01T00:00:00.000Z");
    expect(fetchSpy).not.toHaveBeenCalled();

    const [sub] = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.id, "sub_plan_change"))
      .limit(1);
    expect(sub!.scheduledPlanId).toBe("solo");
    expect(sub!.scheduledPaddlePriceId).toBe("pri_test_solo_month");
    expect(sub!.scheduledChangeEffectiveAt).toBe("2026-09-01T00:00:00.000Z");
    // Current entitlement is untouched — nothing changes until the scheduled sweep applies it.
    expect(sub!.planId).toBe("pro");
    expect(sub!.paddlePriceId).toBe("pri_test_pro_month");
  });

  it("lets the customer cancel a pending scheduled downgrade before its effective date", async () => {
    const cancelResponse = await cancelScheduledRoute(
      ctx(jsonRequest("http://x/api/billing/plan-change/cancel-scheduled", "POST", {}, cookie)),
    );
    expect(cancelResponse.status).toBe(200);

    const [sub] = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.id, "sub_plan_change"))
      .limit(1);
    expect(sub!.scheduledPlanId).toBeNull();
    expect(sub!.scheduledPaddlePriceId).toBeNull();
    expect(sub!.scheduledChangeEffectiveAt).toBeNull();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });
});
