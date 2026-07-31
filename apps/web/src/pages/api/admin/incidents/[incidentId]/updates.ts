import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminAction } from "../../../../../lib/auth/require-admin";
import { addIncidentUpdate } from "../../../../../lib/admin/incidents";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

const bodySchema = z.object({
  status: z.enum(["investigating", "identified", "monitoring", "resolved"]),
  message: z.string().trim().min(1).max(2000),
  reason: z.string().trim().min(3).max(500),
});

/** POST /api/admin/incidents/:incidentId/updates — posts a status update. */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const incidentId = params.incidentId;
    if (!incidentId) throw new ApiError("VALIDATION_FAILED", "Missing incident id.");

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success)
      throw new ApiError("VALIDATION_FAILED", "A status, message, and reason are required.");

    const admin = await requireAdminAction(request, db, {
      action: "incident.update",
      target: incidentId,
      reason: parsed.data.reason,
      requestId,
      newState: { status: parsed.data.status },
    });

    await addIncidentUpdate(db, {
      incidentId,
      status: parsed.data.status,
      message: parsed.data.message,
      createdByUserId: admin.user.id,
    });

    return jsonResponse(ok({ incidentId, status: parsed.data.status }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
