import type { APIRoute } from "astro";
import { notificationTypeSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { listNotifications } from "../../../lib/notifications";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

/** GET /api/notifications — the notification centre feed (SRS §26), with optional type/domain/unread filters and cursor pagination. */
export const GET: APIRoute = async ({ request, url }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const typeParam = url.searchParams.get("type");
    const parsedType = typeParam ? notificationTypeSchema.safeParse(typeParam) : null;

    const result = await listNotifications(db, user.id, {
      cursor: url.searchParams.get("cursor") ?? undefined,
      domainId: url.searchParams.get("domainId") ?? undefined,
      unreadOnly: url.searchParams.get("unreadOnly") === "true",
      type: parsedType?.success ? parsedType.data : undefined,
    });

    return jsonResponse(ok(result, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
