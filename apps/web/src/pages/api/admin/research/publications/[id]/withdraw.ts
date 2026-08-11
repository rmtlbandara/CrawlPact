import type { APIRoute } from "astro";
import { ApiError, adminActionRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../../lib/env";
import { requireAdminAction } from "../../../../../../lib/auth/require-admin";
import { withdrawResearchPublication } from "../../../../../../lib/admin/research";
import { jsonErrorResponse, jsonResponse } from "../../../../../../lib/json-response";

export const prerender = false;

/** POST /api/admin/research/publications/:id/withdraw — terminal (§217).
 * The row and its URL remain; the public page renders a withdrawal notice
 * rather than 404ing or disappearing silently. */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const id = params.id;
    if (!id) throw new ApiError("VALIDATION_FAILED", "Missing publication id.");

    const body = adminActionRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("ADMIN_REASON_REQUIRED", "A reason is required.");

    await requireAdminAction(request, db, {
      action: "research.publication.withdraw",
      target: id,
      reason: body.data.reason,
      requestId,
    });

    await withdrawResearchPublication(db, id, body.data.reason);
    return jsonResponse(ok({ id }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
