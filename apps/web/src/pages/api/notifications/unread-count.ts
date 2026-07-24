import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { getUnreadCount } from "../../../lib/notifications";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

/** GET /api/notifications/unread-count — lightweight badge count, polled by the dashboard nav. */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);
    const count = await getUnreadCount(db, user.id);
    return jsonResponse(ok({ count }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
