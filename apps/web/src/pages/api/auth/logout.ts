import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import {
  buildClearedSessionCookie,
  readSessionToken,
  revokeSession,
} from "../../../lib/auth/session";
import { jsonResponseWithCookie } from "../../../lib/json-response";

export const prerender = false;

/** POST /api/auth/logout — revokes the current session and clears its cookie. */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const token = readSessionToken(request);
  if (token) {
    const db = createDb(getEnv().DB);
    await revokeSession(db, token);
  }
  return jsonResponseWithCookie(
    ok({ signedOut: true }, requestId),
    200,
    buildClearedSessionCookie(),
  );
};
