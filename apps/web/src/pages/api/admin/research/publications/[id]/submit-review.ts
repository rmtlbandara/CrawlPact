import type { APIRoute } from "astro";
import { ApiError, adminActionRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../../lib/env";
import { requireAdminAction } from "../../../../../../lib/auth/require-admin";
import { submitResearchPublicationForReview } from "../../../../../../lib/admin/research";
import { jsonErrorResponse, jsonResponse } from "../../../../../../lib/json-response";

export const prerender = false;

/** POST /api/admin/research/publications/:id/submit-review — draft ->
 * review, blocked if `validateResearchPublicationContent` finds an error
 * (§46, §211). Still not publicly visible after this step. */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const id = params.id;
    if (!id) throw new ApiError("VALIDATION_FAILED", "Missing publication id.");

    const body = adminActionRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("ADMIN_REASON_REQUIRED", "A reason is required.");

    await requireAdminAction(request, db, {
      action: "research.publication.submit_review",
      target: id,
      reason: body.data.reason,
      requestId,
    });

    const validation = await submitResearchPublicationForReview(db, id);
    return jsonResponse(ok({ id, validation }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
