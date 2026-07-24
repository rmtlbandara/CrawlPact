import type { APIRoute } from "astro";
import { desc, eq } from "drizzle-orm";
import { ok, sessionSummarySchema } from "@crawlpact/core";
import type { SessionSummary } from "@crawlpact/core";
import { createDb, schema } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireSession } from "../../../../lib/auth/require-session";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/** GET /api/auth/sessions — lists this user's own non-revoked sessions (SRS §24: "View sessions"). */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { token, user } = await requireSession(request, db);

    const rows = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, user.id))
      .orderBy(desc(schema.sessions.lastSeenAt));

    const sessions: SessionSummary[] = rows
      .filter((row) => !row.revokedAt && new Date(row.expiresAt).getTime() > Date.now())
      .map((row) =>
        sessionSummarySchema.parse({
          sessionId: row.id,
          createdAt: row.createdAt,
          lastSeenAt: row.lastSeenAt,
          userAgent: row.userAgent,
          isCurrent: row.id === token,
        }),
      );

    return jsonResponse(ok(sessions, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
