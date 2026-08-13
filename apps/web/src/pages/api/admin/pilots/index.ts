import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, adminActionRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminAction, requireAdminSession } from "../../../../lib/auth/require-admin";
import { createPilotCohort, listPilotCohorts } from "../../../../lib/admin/pilots";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/** GET /api/admin/pilots — list all pilot cohorts. */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    const cohorts = await listPilotCohorts(db);
    return jsonResponse(ok({ cohorts }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

const createCohortSchema = adminActionRequestSchema.extend({
  name: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
});

/** POST /api/admin/pilots — creates a new pilot cohort (status "draft").
 * Never grants any entitlement — see lib/admin/pilots.ts. */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const body = createCohortSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("VALIDATION_FAILED", "Invalid cohort payload.");

    const admin = await requireAdminAction(request, db, {
      action: "pilot.cohort.create",
      target: body.data.name,
      reason: body.data.reason,
      requestId,
    });

    const id = await createPilotCohort(db, {
      name: body.data.name,
      description: body.data.description ?? null,
      createdByUserId: admin.user.id,
    });
    return jsonResponse(ok({ id }, requestId), 201);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
