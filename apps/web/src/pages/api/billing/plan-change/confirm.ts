import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireSession } from "../../../../lib/auth/require-session";
import { isPaddleBillingConfigured } from "../../../../lib/admin/environment";
import {
  confirmPlanChange,
  getActiveSubscriptionContext,
} from "../../../../lib/billing/plan-change";
import { trackEvent } from "../../../../lib/analytics";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

const requestSchema = z.object({
  planId: z.enum(["solo", "pro", "agency"]),
  interval: z.enum(["month", "year"]),
});

/**
 * POST /api/billing/plan-change/confirm — applies an upgrade immediately (via a real Paddle
 * subscription update) or records a downgrade to apply at the next billing period (purely
 * local — never sent to Paddle until then). Never grants the new entitlement directly — see
 * apps/web/src/pages/api/billing/AGENTS.md: only a verified `subscription.updated` webhook may
 * change `users.plan_id`. Re-validates plan/interval server-side exactly like
 * POST /api/billing/checkout; never trusts a price ID or amount from the browser.
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
    const result = await confirmPlanChange(
      db,
      { PADDLE_API_KEY: env.PADDLE_API_KEY, PADDLE_ENVIRONMENT: env.PADDLE_ENVIRONMENT },
      context,
      parsed.data.planId,
      parsed.data.interval,
    );
    if (!result.ok) {
      await trackEvent(db, "plan_change_failed", {
        userId: user.id,
        properties: { toPlan: parsed.data.planId, reason: result.reason },
      });
      throw new ApiError("VALIDATION_FAILED", result.message);
    }

    await trackEvent(db, "plan_change_confirmed", {
      userId: user.id,
      properties: { toPlan: parsed.data.planId, direction: result.direction },
    });

    return jsonResponse(ok(result, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
