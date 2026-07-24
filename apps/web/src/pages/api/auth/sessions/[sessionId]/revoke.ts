import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { ApiError, ok } from "@crawlpact/core";
import { createDb, schema } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireSession } from "../../../../../lib/auth/require-session";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

/** POST /api/auth/sessions/:sessionId/revoke — ends one of the caller's own sessions (SRS §24). */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const sessionId = params.sessionId;
    if (!sessionId) throw new ApiError("VALIDATION_FAILED", "Missing session id.");

    const result = await db
      .update(schema.sessions)
      .set({ revokedAt: new Date().toISOString() })
      .where(and(eq(schema.sessions.id, sessionId), eq(schema.sessions.userId, user.id)))
      .returning({ id: schema.sessions.id });

    if (result.length === 0) throw new ApiError("NOT_FOUND", "This session does not exist.");

    return jsonResponse(ok({ revoked: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
