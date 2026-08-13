import type { APIRoute } from "astro";
import { ApiError, adminActionRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../../../lib/env";
import { requireAdminAction } from "../../../../../../../lib/auth/require-admin";
import { removePilotParticipant } from "../../../../../../../lib/admin/pilots";
import { jsonErrorResponse, jsonResponse } from "../../../../../../../lib/json-response";

export const prerender = false;

/** POST /api/admin/pilots/:cohortId/participants/:participantId/remove —
 * removes a participation record. Never touches the underlying account
 * (§108, §177 — normal account-deletion lifecycle is unaffected either
 * way). */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const participantId = params.participantId;
    if (!participantId) throw new ApiError("VALIDATION_FAILED", "Missing participant id.");

    const body = adminActionRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("ADMIN_REASON_REQUIRED", "A reason is required.");

    await requireAdminAction(request, db, {
      action: "pilot.participant.remove",
      target: participantId,
      reason: body.data.reason,
      requestId,
    });

    await removePilotParticipant(db, participantId);
    return jsonResponse(ok({ participantId }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
