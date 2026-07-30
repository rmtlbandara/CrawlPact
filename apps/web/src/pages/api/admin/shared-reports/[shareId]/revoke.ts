import type { APIRoute } from "astro";
import { ApiError, adminActionRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminAction } from "../../../../../lib/auth/require-admin";
import { adminRevokeShare } from "../../../../../lib/sharing";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

/** POST /api/admin/shared-reports/:shareId/revoke — SRS §28.9/§28.14. */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const shareId = params.shareId;
    if (!shareId) throw new ApiError("VALIDATION_FAILED", "Missing share id.");

    const body = adminActionRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("ADMIN_REASON_REQUIRED", "A reason is required.");

    await requireAdminAction(request, db, {
      action: "shared_report.revoke",
      target: shareId,
      reason: body.data.reason,
      requestId,
    });

    const { logoObjectKey } = await adminRevokeShare(db, shareId);
    // Deleted only after the D1 revoke above has already committed — see
    // docs/data/DATA_RETENTION.md's "R2 deletion must never precede the D1
    // reference" rule (a failed R2 delete here just leaves an orphan object
    // for the retention sweep, never a dangling reference to live bytes).
    if (logoObjectKey) {
      await getEnv().AGENCY_LOGOS.delete(logoObjectKey);
    }
    return jsonResponse(ok({ shareId, revoked: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
