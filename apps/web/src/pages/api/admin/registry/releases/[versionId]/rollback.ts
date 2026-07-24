import type { APIRoute } from "astro";
import { ApiError, adminActionRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../../lib/env";
import { requireAdminAction } from "../../../../../../lib/auth/require-admin";
import { rollbackRegistryVersion } from "../../../../../../lib/admin/registry";
import { jsonErrorResponse, jsonResponse } from "../../../../../../lib/json-response";

export const prerender = false;

/** POST /api/admin/registry/releases/:versionId/rollback — SRS §28.11:
 * repoints the active pointer only. Never deletes any release. */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const versionId = params.versionId;
    if (!versionId) throw new ApiError("VALIDATION_FAILED", "Missing registry version id.");

    const body = adminActionRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("ADMIN_REASON_REQUIRED", "A reason is required.");

    await requireAdminAction(request, db, {
      action: "registry.release.rollback",
      target: versionId,
      reason: body.data.reason,
      requestId,
    });

    await rollbackRegistryVersion(db, versionId);
    return jsonResponse(ok({ versionId, active: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
