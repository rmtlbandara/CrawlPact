import type { APIRoute } from "astro";
import { ApiError, adminActionRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../../lib/env";
import { requireAdminAction } from "../../../../../../lib/auth/require-admin";
import { publishRulesetVersion } from "../../../../../../lib/admin/registry";
import { jsonErrorResponse, jsonResponse } from "../../../../../../lib/json-response";

export const prerender = false;

/** POST /api/admin/registry/rulesets/:versionId/publish — SRS §28.12. */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const versionId = params.versionId;
    if (!versionId) throw new ApiError("VALIDATION_FAILED", "Missing ruleset version id.");

    const body = adminActionRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("ADMIN_REASON_REQUIRED", "A reason is required.");

    const admin = await requireAdminAction(request, db, {
      action: "registry.ruleset.publish",
      target: versionId,
      reason: body.data.reason,
      requestId,
    });

    await publishRulesetVersion(db, versionId, admin.user.id);
    return jsonResponse(ok({ versionId, published: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
