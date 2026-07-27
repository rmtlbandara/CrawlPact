import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { priceIdForPlan } from "../../../lib/billing/plan-mapping";
import type { PaidPlanId } from "../../../lib/billing/plan-mapping";
import { trackEvent } from "../../../lib/analytics";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";
import { isPaddleBillingConfigured } from "../../../lib/admin/environment";

export const prerender = false;

const checkoutRequestSchema = z.object({ planId: z.enum(["solo", "pro", "agency"]) });

/**
 * POST /api/billing/checkout — resolves which Paddle price ID and
 * `custom_data` the client-side Paddle.js overlay checkout should open
 * with. Paddle Billing v2's recommended integration opens Checkout
 * entirely client-side (Paddle.Checkout.open), so this endpoint doesn't
 * call Paddle's API at all — it just hands back the price ID for the
 * requested plan plus the caller's own user ID as custom_data, so the
 * resulting webhook events (subscription.created etc., see
 * lib/billing/webhook-processor.ts) can link back to this account.
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
      throw new ApiError("VALIDATION_FAILED", "Choose a plan to upgrade to.", {
        issues: parsed.error.issues,
      });
    }

    const env = getEnv();
    const priceId = priceIdForPlan(env, parsed.data.planId as PaidPlanId);

    await trackEvent(db, "checkout_started", {
      userId: user.id,
      properties: { planId: parsed.data.planId },
    });

    return jsonResponse(
      ok(
        {
          priceId,
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
