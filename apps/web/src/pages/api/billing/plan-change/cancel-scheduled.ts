import type { APIRoute } from "astro";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireSession } from "../../../../lib/auth/require-session";
import {
  cancelScheduledPlanChange,
  getActiveSubscriptionContext,
} from "../../../../lib/billing/plan-change";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/** POST /api/billing/plan-change/cancel-scheduled — lets a customer undo a scheduled downgrade
 * before its effective date. Purely local: a scheduled change is never sent to Paddle until it
 * applies, so there is nothing to undo there. */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const context = await getActiveSubscriptionContext(db, user.id);
    if (!context) {
      throw new ApiError("VALIDATION_FAILED", "You don't have an active paid subscription.");
    }

    await cancelScheduledPlanChange(db, context.subscriptionRowId);
    return jsonResponse(ok({ cancelled: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
