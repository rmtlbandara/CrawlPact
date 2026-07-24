import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

/** GET /api/auth/session — the caller's own identity, for client-side "am I signed in" checks. */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);
    return jsonResponse(
      ok({ id: user.id, displayName: user.displayName, isAdmin: user.isAdmin }, requestId),
      200,
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
