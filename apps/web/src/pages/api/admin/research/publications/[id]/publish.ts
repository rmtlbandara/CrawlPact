import type { APIRoute } from "astro";
import { ApiError, adminActionRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../../lib/env";
import { requireAdminAction } from "../../../../../../lib/auth/require-admin";
import { publishResearchPublication } from "../../../../../../lib/admin/research";
import { jsonErrorResponse, jsonResponse } from "../../../../../../lib/json-response";

export const prerender = false;

/**
 * POST /api/admin/research/publications/:id/publish — review -> published.
 * The only action that makes a Policy Observatory publication publicly
 * visible (§45/§212). Publishing a research study is a meaningful
 * public-trust action, gated the same way registry-release publication is.
 */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const id = params.id;
    if (!id) throw new ApiError("VALIDATION_FAILED", "Missing publication id.");

    const body = adminActionRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("ADMIN_REASON_REQUIRED", "A reason is required.");

    const admin = await requireAdminAction(request, db, {
      action: "research.publication.publish",
      target: id,
      reason: body.data.reason,
      requestId,
    });

    const result = await publishResearchPublication(db, id, admin.user.id);
    return jsonResponse(ok({ id, ...result }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
