import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { resolveCheckoutPrice } from "../../../lib/billing/plan-catalog";
import { trackEvent } from "../../../lib/analytics";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";
import { isPaddleBillingConfigured } from "../../../lib/admin/environment";

export const prerender = false;

const checkoutRequestSchema = z.object({
  planId: z.enum(["solo", "pro", "agency"]),
  interval: z.enum(["month", "year"]),
});

/**
 * POST /api/billing/checkout — resolves which Paddle price ID and
 * `custom_data` the client-side Paddle.js overlay checkout should open
 * with. Paddle Billing v2's recommended integration opens Checkout
 * entirely client-side (Paddle.Checkout.open), so this endpoint doesn't
 * call Paddle's API at all — it just hands back the price ID for the
 * requested plan/interval plus the caller's own user ID as custom_data, so
 * the resulting webhook events (subscription.created etc., see
 * lib/billing/webhook-processor.ts) can link back to this account.
 *
 * The browser sends only `planId`/`interval` — never a price ID or amount
 * (see docs/security/PHASE_06_BILLING_AND_CHECKOUT_THREAT_REVIEW.md).
 * `resolveCheckoutPrice` only ever returns a price marked
 * `active_for_new_checkout` in the caller's own runtime environment — a
 * legacy price, an archived price, or a price from the wrong environment
 * can never be resolved here, regardless of what a client requests.
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    if (!isPaddleBillingConfigured()) {
      throw new ApiError("SERVICE_UNAVAILABLE", "Billing is not available in this environment.");
    }

    const body = await request.json().catch(() => {
      throw new ApiError("VALIDATION_FAILED", "Request body must be valid JSON.");
    });
    const parsed = checkoutRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Choose a plan and billing interval.", {
        issues: parsed.error.issues,
      });
    }

    const env = getEnv();
    const price = await resolveCheckoutPrice(
      db,
      env.PADDLE_ENVIRONMENT,
      parsed.data.planId,
      parsed.data.interval,
    );
    if (!price) {
      throw new ApiError("VALIDATION_FAILED", "This plan is not currently available for checkout.");
    }

    await trackEvent(db, "checkout_started", {
      userId: user.id,
      properties: { planId: parsed.data.planId, interval: parsed.data.interval },
    });

    return jsonResponse(
      ok(
        {
          priceId: price.paddlePriceId,
          customData: { userId: user.id },
          clientToken: env.PUBLIC_PADDLE_CLIENT_TOKEN,
          environment: env.PADDLE_ENVIRONMENT,
        },
        requestId,
      ),
      200,
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
