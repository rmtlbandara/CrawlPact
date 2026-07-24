import type { APIRoute } from "astro";
import { and, eq, isNull } from "drizzle-orm";
import { ok } from "@crawlpact/core";
import { createDb, schema } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireSession } from "../../../../lib/auth/require-session";
import { buildClearedSessionCookie } from "../../../../lib/auth/session";
import { jsonErrorResponse, jsonResponseWithCookie } from "../../../../lib/json-response";

export const prerender = false;

/** POST /api/auth/sessions/revoke-all — "Sign out all sessions" (SRS §24), including this one. */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    await db
      .update(schema.sessions)
      .set({ revokedAt: new Date().toISOString() })
      .where(and(eq(schema.sessions.userId, user.id), isNull(schema.sessions.revokedAt)));

    return jsonResponseWithCookie(
      ok({ revoked: true }, requestId),
      200,
      buildClearedSessionCookie(),
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
