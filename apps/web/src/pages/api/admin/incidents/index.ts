import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminAction, requireAdminSession } from "../../../../lib/auth/require-admin";
import { createIncident, listIncidents } from "../../../../lib/admin/incidents";
import { isStatusComponentKey } from "../../../../lib/status/components";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  publicSummary: z.string().trim().min(1).max(2000),
  severity: z.enum(["minor", "major", "critical"]),
  affectedComponents: z.array(z.string()).min(1),
  isScheduledMaintenance: z.boolean(),
  isPublic: z.boolean(),
  startsAt: z.string().trim().min(1),
  initialStatus: z.enum(["investigating", "identified", "monitoring", "resolved"]),
  initialMessage: z.string().trim().min(1).max(2000),
  reason: z.string().trim().min(3).max(500),
});

/** GET /api/admin/incidents */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    return jsonResponse(ok(await listIncidents(db), requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

/** POST /api/admin/incidents — creates an incident with its first update. */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ApiError(
        "VALIDATION_FAILED",
        "A title, summary, severity, at least one affected component, start time, initial status/message, and reason are required.",
      );
    }
    if (!parsed.data.affectedComponents.every(isStatusComponentKey)) {
      throw new ApiError("VALIDATION_FAILED", "Unknown affected component.");
    }

    const admin = await requireAdminAction(request, db, {
      action: "incident.create",
      target: parsed.data.title,
      reason: parsed.data.reason,
      requestId,
      newState: { severity: parsed.data.severity, status: parsed.data.initialStatus },
    });

    const id = await createIncident(db, {
      title: parsed.data.title,
      publicSummary: parsed.data.publicSummary,
      severity: parsed.data.severity,
      affectedComponents: parsed.data.affectedComponents,
      isScheduledMaintenance: parsed.data.isScheduledMaintenance,
      isPublic: parsed.data.isPublic,
      startsAt: parsed.data.startsAt,
      initialStatus: parsed.data.initialStatus,
      initialMessage: parsed.data.initialMessage,
      createdByUserId: admin.user.id,
    });

    return jsonResponse(ok({ id }, requestId), 201);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
