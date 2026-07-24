import type { APIRoute } from "astro";
import { ApiError, adminActionRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminAction } from "../../../../../lib/auth/require-admin";
import { triggerAdminScan } from "../../../../../lib/admin/domains";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

/** POST /api/admin/domains/:domainId/scan — SRS §28.8. Does not consume the
 * owner's manual-rescan quota (see lib/admin/domains.ts). */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const domainId = params.domainId;
    if (!domainId) throw new ApiError("VALIDATION_FAILED", "Missing domain id.");

    const body = adminActionRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("ADMIN_REASON_REQUIRED", "A reason is required.");

    const admin = await requireAdminAction(request, db, {
      action: "domain.admin_scan",
      target: domainId,
      reason: body.data.reason,
      requestId,
    });

    const outcome = await triggerAdminScan(db, domainId, admin.user.id);
    if ("error" in outcome) throw new ApiError("NOT_FOUND", outcome.error);

    return jsonResponse(
      ok({ scanId: outcome.scanId, status: outcome.result.status }, requestId),
      200,
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
