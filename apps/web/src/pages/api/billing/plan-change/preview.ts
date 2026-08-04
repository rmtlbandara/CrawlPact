import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireSession } from "../../../../lib/auth/require-session";
import { isPaddleBillingConfigured } from "../../../../lib/admin/environment";
import {
  getActiveSubscriptionContext,
  previewPlanChange,
} from "../../../../lib/billing/plan-change";
import { trackEvent } from "../../../../lib/analytics";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

const requestSchema = z.object({
  planId: z.enum(["solo", "pro", "agency"]),
  interval: z.enum(["month", "year"]),
});

/**
 * POST /api/billing/plan-change/preview — read-only. Never mutates Paddle or local state; used
 * to show a real, Paddle-calculated proration figure before the customer confirms an upgrade, or
 * the scheduled-change effective date before they confirm a downgrade. See
 * docs/billing/PLAN_CHANGE_AND_PRORATION_POLICY.md.
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
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Choose a plan and billing interval.", {
        issues: parsed.error.issues,
      });
    }

    const context = await getActiveSubscriptionContext(db, user.id);
    if (!context) {
      throw new ApiError(
        "VALIDATION_FAILED",
        "You don't have an active paid subscription to change. Use the plan cards below to subscribe.",
      );
    }

    const env = getEnv();
    const preview = await previewPlanChange(
      db,
      { PADDLE_API_KEY: env.PADDLE_API_KEY, PADDLE_ENVIRONMENT: env.PADDLE_ENVIRONMENT },
      context,
      parsed.data.planId,
      parsed.data.interval,
    );
    if (!preview.ok) {
      throw new ApiError("VALIDATION_FAILED", preview.message);
    }

    await trackEvent(db, "plan_change_previewed", {
      userId: user.id,
      properties: {
        fromPlan: context.currentPlanId,
        toPlan: parsed.data.planId,
        direction: preview.direction,
      },
    });

    return jsonResponse(ok(preview, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
