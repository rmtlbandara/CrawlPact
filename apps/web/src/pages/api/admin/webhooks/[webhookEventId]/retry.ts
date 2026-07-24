import type { APIRoute } from "astro";
import { ApiError, adminActionRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminAction } from "../../../../../lib/auth/require-admin";
import { retryWebhookEvent } from "../../../../../lib/admin/webhooks";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

/** POST /api/admin/webhooks/:webhookEventId/retry — SRS §28.7. Idempotent:
 * reuses the exact same processing path a live Paddle delivery takes. */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const webhookEventId = params.webhookEventId;
    if (!webhookEventId) throw new ApiError("VALIDATION_FAILED", "Missing webhook event id.");

    const body = adminActionRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("ADMIN_REASON_REQUIRED", "A reason is required.");

    await requireAdminAction(request, db, {
      action: "webhook.retry",
      target: webhookEventId,
      reason: body.data.reason,
      requestId,
    });

    const env = getEnv();
    const result = await retryWebhookEvent(
      db,
      {
        PADDLE_PRICE_ID_SOLO: env.PADDLE_PRICE_ID_SOLO,
        PADDLE_PRICE_ID_PRO: env.PADDLE_PRICE_ID_PRO,
        PADDLE_PRICE_ID_AGENCY: env.PADDLE_PRICE_ID_AGENCY,
      },
      webhookEventId,
    );
    if (!result.ok) throw new ApiError("VALIDATION_FAILED", result.reason);

    return jsonResponse(ok({ webhookEventId, outcome: result.outcome }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
