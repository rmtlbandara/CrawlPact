import type { APIRoute } from "astro";
import { ApiError, adminActionRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminAction } from "../../../../../lib/auth/require-admin";
import { revokeTemporaryEntitlement } from "../../../../../lib/admin/subscriptions";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

/** POST /api/admin/entitlements/:entitlementId/revoke — SRS §28.5. Reverts
 * the user's plan immediately to whatever their own real Paddle
 * subscription entitles them to (or `free`) — the same logic the daily
 * expiry sweep uses, so early revocation isn't silently delayed until the
 * original expiry date. */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const entitlementId = params.entitlementId;
    if (!entitlementId) throw new ApiError("VALIDATION_FAILED", "Missing entitlement id.");

    const body = adminActionRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("ADMIN_REASON_REQUIRED", "A reason is required.");

    await requireAdminAction(request, db, {
      action: "entitlement.revoke",
      target: entitlementId,
      reason: body.data.reason,
      requestId,
    });

    await revokeTemporaryEntitlement(db, entitlementId);
    return jsonResponse(ok({ entitlementId, revoked: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
