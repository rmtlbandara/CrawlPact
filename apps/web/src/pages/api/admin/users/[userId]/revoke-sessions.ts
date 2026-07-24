import type { APIRoute } from "astro";
import { ApiError, adminActionRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminAction } from "../../../../../lib/auth/require-admin";
import { revokeAllSessionsForUser } from "../../../../../lib/admin/users";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

/** POST /api/admin/users/:userId/revoke-sessions — SRS §28.3/§28.14. */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const userId = params.userId;
    if (!userId) throw new ApiError("VALIDATION_FAILED", "Missing user id.");

    const body = adminActionRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("ADMIN_REASON_REQUIRED", "A reason is required.");

    await requireAdminAction(request, db, {
      action: "user.revoke_sessions",
      target: userId,
      reason: body.data.reason,
      requestId,
    });

    await revokeAllSessionsForUser(db, userId);
    return jsonResponse(ok({ userId, revoked: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
