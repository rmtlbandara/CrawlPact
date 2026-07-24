import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { listActiveCredentials } from "../../../../lib/auth/credentials";
import { requireSession } from "../../../../lib/auth/require-session";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/** GET /api/auth/passkeys — lists the caller's own registered passkeys (SRS §24). */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);
    const rows = await listActiveCredentials(db, user.id);

    return jsonResponse(
      ok(
        rows.map((row) => ({
          credentialId: row.id,
          label: row.label,
          createdAt: row.createdAt,
          lastUsedAt: row.lastUsedAt,
        })),
        requestId,
      ),
      200,
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
