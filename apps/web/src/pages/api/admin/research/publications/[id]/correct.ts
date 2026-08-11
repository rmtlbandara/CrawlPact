import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../../lib/env";
import { requireAdminAction } from "../../../../../../lib/auth/require-admin";
import { correctResearchPublication } from "../../../../../../lib/admin/research";
import { jsonErrorResponse, jsonResponse } from "../../../../../../lib/json-response";

export const prerender = false;

const correctRequestSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  what: z.string().trim().min(3).max(2000),
  why: z.string().trim().min(3).max(2000),
  conclusionsChanged: z.boolean(),
});

/**
 * POST /api/admin/research/publications/:id/correct — recomputes content
 * from the *same pinned* registry release and records a visible correction
 * entry (§47/§49). Never a silent edit — `what`/`why`/`conclusionsChanged`
 * are required and stored in the publication's own correction log, not just
 * the admin audit log.
 */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const id = params.id;
    if (!id) throw new ApiError("VALIDATION_FAILED", "Missing publication id.");

    const body = correctRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("VALIDATION_FAILED", "Invalid correction payload.");

    await requireAdminAction(request, db, {
      action: "research.publication.correct",
      target: id,
      reason: body.data.reason,
      requestId,
    });

    await correctResearchPublication(db, id, {
      what: body.data.what,
      why: body.data.why,
      conclusionsChanged: body.data.conclusionsChanged,
    });
    return jsonResponse(ok({ id }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
