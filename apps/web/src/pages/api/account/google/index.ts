import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireSession } from "../../../../lib/auth/require-session";
import { findGoogleAccountByUserId } from "../../../../lib/auth/google-account";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/** GET /api/account/google — whether the caller's account has a connected Google identity. */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);
    const account = await findGoogleAccountByUserId(db, user.id);

    return jsonResponse(
      ok(
        {
          connected: account !== null,
          email: account?.email ?? null,
          connectedAt: account?.createdAt ?? null,
        },
        requestId,
      ),
      200,
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
