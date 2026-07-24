import type { APIRoute } from "astro";
import { ApiError, ok } from "@crawlpact/core";
import { z } from "zod";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminAction } from "../../../../../lib/auth/require-admin";
import { resolveSecurityEvent } from "../../../../../lib/admin/security";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

const bodySchema = z.object({ note: z.string().trim().min(3).max(1000) });

/** POST /api/admin/security/:eventId/resolve — SRS §28.14 "security-event
 * resolution". The note doubles as the audited reason. */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const eventId = Number(params.eventId);
    if (!params.eventId || Number.isNaN(eventId))
      throw new ApiError("VALIDATION_FAILED", "Missing security event id.");

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError("VALIDATION_FAILED", "A resolution note is required.");

    const admin = await requireAdminAction(request, db, {
      action: "security_event.resolve",
      target: String(eventId),
      reason: parsed.data.note,
      requestId,
    });

    await resolveSecurityEvent(db, eventId, {
      resolvedByUserId: admin.user.id,
      note: parsed.data.note,
    });
    return jsonResponse(ok({ eventId, resolved: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
