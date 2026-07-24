import type { APIRoute } from "astro";
import { ApiError, adminActionRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminAction } from "../../../../../lib/auth/require-admin";
import { unblockTarget } from "../../../../../lib/blocked-targets";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

/** POST /api/admin/blocked-targets/:blockedTargetId/unblock — SRS §28.8/§28.14. */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const blockedTargetId = params.blockedTargetId;
    if (!blockedTargetId) throw new ApiError("VALIDATION_FAILED", "Missing blocked target id.");

    const body = adminActionRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("ADMIN_REASON_REQUIRED", "A reason is required.");

    await requireAdminAction(request, db, {
      action: "target.unblock",
      target: blockedTargetId,
      reason: body.data.reason,
      requestId,
    });

    await unblockTarget(db, blockedTargetId);
    return jsonResponse(ok({ blockedTargetId, unblocked: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
