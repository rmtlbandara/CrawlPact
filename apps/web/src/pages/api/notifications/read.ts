import type { APIRoute } from "astro";
import { ApiError, markNotificationsReadRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { markNotificationsRead } from "../../../lib/notifications";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

/** POST /api/notifications/read — "Mark as read" for one or more notifications the caller owns. */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const body = await request.json().catch(() => {
      throw new ApiError("VALIDATION_FAILED", "Request body must be valid JSON.");
    });
    const parsed = markNotificationsReadRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Provide at least one notification id.", {
        issues: parsed.error.issues,
      });
    }

    await markNotificationsRead(db, user.id, parsed.data.notificationIds);
    return jsonResponse(ok({ updated: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
