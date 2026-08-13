import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, adminActionRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminAction, requireAdminSession } from "../../../../../lib/auth/require-admin";
import {
  getPilotCohort,
  listPilotFeedback,
  listPilotParticipants,
  updatePilotCohortStatus,
} from "../../../../../lib/admin/pilots";
import { getPilotCohortMetrics } from "../../../../../lib/admin/pilot-analytics";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

/** GET /api/admin/pilots/:cohortId — cohort detail, participants, live
 * metrics (derived, never stored), and feedback. */
export const GET: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    const cohortId = params.cohortId;
    if (!cohortId) throw new ApiError("VALIDATION_FAILED", "Missing cohort id.");

    const cohort = await getPilotCohort(db, cohortId);
    if (!cohort) throw new ApiError("NOT_FOUND", "Pilot cohort not found.");

    const [participants, metrics, feedback] = await Promise.all([
      listPilotParticipants(db, cohortId),
      getPilotCohortMetrics(db, cohortId),
      listPilotFeedback(db, cohortId),
    ]);
    return jsonResponse(ok({ cohort, participants, metrics, feedback }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

const statusSchema = adminActionRequestSchema.extend({
  status: z.enum(["draft", "recruiting", "active", "analysis", "completed", "cancelled"]),
});

/** POST /api/admin/pilots/:cohortId — updates cohort status. */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const cohortId = params.cohortId;
    if (!cohortId) throw new ApiError("VALIDATION_FAILED", "Missing cohort id.");

    const body = statusSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("VALIDATION_FAILED", "Invalid status payload.");

    await requireAdminAction(request, db, {
      action: "pilot.cohort.status_change",
      target: cohortId,
      reason: body.data.reason,
      requestId,
    });

    await updatePilotCohortStatus(db, cohortId, body.data.status);
    return jsonResponse(ok({ cohortId, status: body.data.status }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
