import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, adminActionRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../../lib/env";
import { requireAdminAction } from "../../../../../../lib/auth/require-admin";
import { addPilotParticipant } from "../../../../../../lib/admin/pilots";
import { jsonErrorResponse, jsonResponse } from "../../../../../../lib/json-response";
import { trackEvent } from "../../../../../../lib/analytics";

export const prerender = false;

const addParticipantSchema = adminActionRequestSchema.extend({
  userId: z.string().trim().min(1),
  segment: z.enum(["individual", "professional", "agency", "multi_site", "other"]),
  acquisitionSource: z
    .enum(["direct_owner_outreach", "existing_contact", "referral", "organic_interest", "other"])
    .optional(),
});

/** POST /api/admin/pilots/:cohortId/participants — associates an *existing*
 * CrawlPact user with the cohort (looked up via GET /api/admin/users, id
 * only — this repo has no email column). Never grants an entitlement. */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const cohortId = params.cohortId;
    if (!cohortId) throw new ApiError("VALIDATION_FAILED", "Missing cohort id.");

    const body = addParticipantSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("VALIDATION_FAILED", "Invalid participant payload.");

    const admin = await requireAdminAction(request, db, {
      action: "pilot.participant.add",
      target: `${cohortId}:${body.data.userId}`,
      reason: body.data.reason,
      requestId,
    });

    const id = await addPilotParticipant(db, {
      pilotCohortId: cohortId,
      userId: body.data.userId,
      segment: body.data.segment,
      acquisitionSource: body.data.acquisitionSource,
      addedByAdminUserId: admin.user.id,
    });
    await trackEvent(db, "pilot_joined", {
      userId: body.data.userId,
      properties: { segment: body.data.segment },
    });
    return jsonResponse(ok({ id }, requestId), 201);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
