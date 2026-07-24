import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { markAllNotificationsRead } from "../../../lib/notifications";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

/** POST /api/notifications/read-all — "Mark all as read" (SRS §10.41). */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);
    await markAllNotificationsRead(db, user.id);
    return jsonResponse(ok({ updated: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
