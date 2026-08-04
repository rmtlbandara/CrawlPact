/**
 * The one place that calls Paddle's REST API server-to-server (as opposed
 * to the client-side Paddle.js checkout, or the inbound webhook receiver).
 * Currently only the customer portal session endpoint needs this.
 *
 * UNVERIFIED against a live Paddle account — no sandbox credentials were
 * available for this phase (see the Part 2 final report). The URL,
 * endpoint shape, and response shape follow Paddle's publicly documented
 * API as best understood; treat this as needing a real-account smoke test
 * before launch, not as a confirmed-working integration.
 */

function apiBaseUrl(environment: "sandbox" | "production"): string {
  return environment === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";
}

export type CreatePortalSessionResult =
  | { ok: true; url: string }
  | { ok: false; reason: "paddle_api_error"; status: number; message: string };

export async function createCustomerPortalSession(
  env: { PADDLE_API_KEY: string; PADDLE_ENVIRONMENT: "sandbox" | "production" },
  paddleCustomerId: string,
): Promise<CreatePortalSessionResult> {
  const response = await fetch(
    `${apiBaseUrl(env.PADDLE_ENVIRONMENT)}/customers/${paddleCustomerId}/portal-sessions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.PADDLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    },
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    return { ok: false, reason: "paddle_api_error", status: response.status, message };
  }

  const body = (await response.json()) as { data?: { urls?: { general?: { overview?: string } } } };
  const url = body.data?.urls?.general?.overview;
  if (!url)
    return {
      ok: false,
      reason: "paddle_api_error",
      status: response.status,
      message: "No portal URL in response.",
    };

  return { ok: true, url };
}

export type PreviewSubscriptionUpdateResult =
  | {
      ok: true;
      currencyCode: string;
      immediateTotalCents: number | null;
      nextBilledAt: string | null;
    }
  | { ok: false; reason: "paddle_api_error"; status: number; message: string };

/**
 * Read-only proration preview (SRS-adjacent Phase 6 requirement: never calculate proration in
 * the browser, always show a real Paddle-calculated preview before a plan change is confirmed).
 * Never mutates the subscription — see `updateSubscriptionItem` for the real, destructive call.
 */
export async function previewSubscriptionUpdate(
  env: { PADDLE_API_KEY: string; PADDLE_ENVIRONMENT: "sandbox" | "production" },
  paddleSubscriptionId: string,
  priceId: string,
): Promise<PreviewSubscriptionUpdateResult> {
  const response = await fetch(
    `${apiBaseUrl(env.PADDLE_ENVIRONMENT)}/subscriptions/${paddleSubscriptionId}/preview`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${env.PADDLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity: 1 }],
        proration_billing_mode: "prorated_immediately",
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    return { ok: false, reason: "paddle_api_error", status: response.status, message };
  }

  const body = (await response.json()) as {
    data?: {
      currency_code?: string;
      next_billed_at?: string | null;
      immediate_transaction?: { details?: { totals?: { grand_total?: string } } } | null;
    };
  };
  const data = body.data;
  if (!data?.currency_code) {
    return {
      ok: false,
      reason: "paddle_api_error",
      status: response.status,
      message: "Malformed subscription preview response.",
    };
  }

  const immediateTotal = data.immediate_transaction?.details?.totals?.grand_total;
  return {
    ok: true,
    currencyCode: data.currency_code,
    immediateTotalCents: immediateTotal !== undefined ? Number(immediateTotal) : null,
    nextBilledAt: data.next_billed_at ?? null,
  };
}

export type UpdateSubscriptionItemResult =
  { ok: true } | { ok: false; reason: "paddle_api_error"; status: number; message: string };

/**
 * The one real, destructive plan-change call (SRS-adjacent — see
 * docs/billing/PLAN_CHANGE_AND_PRORATION_POLICY.md). Deliberately does not return — and this
 * module's caller must not itself write — the new plan/price onto the local `subscriptions` row.
 * Per apps/web/src/pages/api/billing/AGENTS.md, `users.plan_id` (and this row's own `plan_id`)
 * may only ever change from a verified webhook event, never directly from this call's success
 * response — `subscription.updated` will arrive and apply it through the normal, CAS-protected
 * path in `webhook-processor.ts`.
 */
export async function updateSubscriptionItem(
  env: { PADDLE_API_KEY: string; PADDLE_ENVIRONMENT: "sandbox" | "production" },
  paddleSubscriptionId: string,
  priceId: string,
  prorationBillingMode: "prorated_immediately" | "do_not_bill",
): Promise<UpdateSubscriptionItemResult> {
  const response = await fetch(
    `${apiBaseUrl(env.PADDLE_ENVIRONMENT)}/subscriptions/${paddleSubscriptionId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${env.PADDLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity: 1 }],
        proration_billing_mode: prorationBillingMode,
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    return { ok: false, reason: "paddle_api_error", status: response.status, message };
  }
  return { ok: true };
}

export type GetSubscriptionResult =
  | {
      ok: true;
      status: string;
      priceId: string;
      currentPeriodEnd: string | null;
    }
  | { ok: false; reason: "paddle_api_error"; status: number; message: string };

/**
 * SRS §28.5 "Paddle resynchronisation" — refetches a subscription's current
 * state directly from Paddle rather than trusting the local cache, used by
 * `lib/admin/subscriptions.ts`'s admin resync action. Same unverified-shape
 * caveat as `createCustomerPortalSession` above.
 */
export async function getSubscription(
  env: { PADDLE_API_KEY: string; PADDLE_ENVIRONMENT: "sandbox" | "production" },
  paddleSubscriptionId: string,
): Promise<GetSubscriptionResult> {
  const response = await fetch(
    `${apiBaseUrl(env.PADDLE_ENVIRONMENT)}/subscriptions/${paddleSubscriptionId}`,
    { headers: { Authorization: `Bearer ${env.PADDLE_API_KEY}` } },
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    return { ok: false, reason: "paddle_api_error", status: response.status, message };
  }

  const body = (await response.json()) as {
    data?: {
      status?: string;
      current_billing_period?: { ends_at?: string };
      items?: { price?: { id?: string } }[];
    };
  };
  const data = body.data;
  if (!data?.status) {
    return {
      ok: false,
      reason: "paddle_api_error",
      status: response.status,
      message: "Malformed subscription response.",
    };
  }

  return {
    ok: true,
    status: data.status,
    priceId: data.items?.[0]?.price?.id ?? "",
    currentPeriodEnd: data.current_billing_period?.ends_at ?? null,
  };
}
