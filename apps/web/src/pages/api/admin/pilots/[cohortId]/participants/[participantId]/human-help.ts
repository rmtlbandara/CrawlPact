import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../../../lib/env";
import { requireAdminAction } from "../../../../../../../lib/auth/require-admin";
import { recordPilotHumanHelp } from "../../../../../../../lib/admin/pilots";
import { addInternalNote } from "../../../../../../../lib/admin/users";
import { jsonErrorResponse, jsonResponse } from "../../../../../../../lib/json-response";

export const prerender = false;

const humanHelpSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  userId: z.string().trim().min(1),
  note: z.string().trim().min(3).max(2000),
});

/**
 * POST /api/admin/pilots/:cohortId/participants/:participantId/human-help —
 * records one meaningful human-help intervention (§79). Increments the
 * participant's counter and records the narrative via the existing
 * internal_user_notes mechanism (no new free-text table).
 */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const participantId = params.participantId;
    if (!participantId) throw new ApiError("VALIDATION_FAILED", "Missing participant id.");

    const body = humanHelpSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("VALIDATION_FAILED", "Invalid human-help payload.");

    const admin = await requireAdminAction(request, db, {
      action: "pilot.participant.human_help_recorded",
      target: participantId,
      reason: body.data.reason,
      requestId,
    });

    await recordPilotHumanHelp(db, participantId);
    await addInternalNote(db, {
      userId: body.data.userId,
      authorUserId: admin.user.id,
      note: `[Pilot support] ${body.data.note}`,
    });
    return jsonResponse(ok({ participantId }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
