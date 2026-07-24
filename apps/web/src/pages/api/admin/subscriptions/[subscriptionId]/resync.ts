import type { APIRoute } from "astro";
import { ApiError, adminActionRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminAction } from "../../../../../lib/auth/require-admin";
import { resyncSubscription } from "../../../../../lib/admin/subscriptions";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

/** POST /api/admin/subscriptions/:subscriptionId/resync — SRS §28.5. A real
 * call to Paddle's API (not a no-op) — see docs/security/BILLING_SECURITY.md
 * for why this is unverified against a live account in this environment. */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const subscriptionId = params.subscriptionId;
    if (!subscriptionId) throw new ApiError("VALIDATION_FAILED", "Missing subscription id.");

    const body = adminActionRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("ADMIN_REASON_REQUIRED", "A reason is required.");

    await requireAdminAction(request, db, {
      action: "subscription.resync",
      target: subscriptionId,
      reason: body.data.reason,
      requestId,
    });

    const env = getEnv();
    const result = await resyncSubscription(db, env, subscriptionId);
    if (!result.ok) {
      throw new ApiError("BILLING_SYNC_ERROR", `Resynchronisation failed: ${result.message}`);
    }
    return jsonResponse(ok({ subscriptionId, resynced: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
