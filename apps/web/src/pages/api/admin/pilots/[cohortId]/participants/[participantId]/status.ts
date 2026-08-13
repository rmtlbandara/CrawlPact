import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, adminActionRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../../../lib/env";
import { requireAdminAction } from "../../../../../../../lib/auth/require-admin";
import { updatePilotParticipantStatus } from "../../../../../../../lib/admin/pilots";
import { jsonErrorResponse, jsonResponse } from "../../../../../../../lib/json-response";

export const prerender = false;

const statusSchema = adminActionRequestSchema.extend({
  status: z.enum([
    "invited",
    "joined",
    "active",
    "completed",
    "withdrew",
    "inactive",
    "disqualified",
  ]),
});

/** POST /api/admin/pilots/:cohortId/participants/:participantId/status */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const participantId = params.participantId;
    if (!participantId) throw new ApiError("VALIDATION_FAILED", "Missing participant id.");

    const body = statusSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("VALIDATION_FAILED", "Invalid status payload.");

    await requireAdminAction(request, db, {
      action: "pilot.participant.status_change",
      target: participantId,
      reason: body.data.reason,
      requestId,
    });

    await updatePilotParticipantStatus(db, participantId, body.data.status);
    return jsonResponse(ok({ participantId, status: body.data.status }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
