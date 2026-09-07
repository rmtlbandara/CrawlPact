import type { APIRoute } from "astro";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireRecentAuthentication, requireSession } from "../../../../lib/auth/require-session";
import { disconnectGoogleAccount } from "../../../../lib/auth/google-account";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/**
 * POST /api/account/google/disconnect — authenticated, requires recent
 * authentication (removing a sign-in method is sensitive, same as passkey
 * removal). Refuses outright if disconnecting would leave the account with
 * no usable sign-in method (section 24) — recovery codes don't count as a
 * usable primary method for this check, only an active passkey does.
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user, session } = await requireSession(request, db);
    requireRecentAuthentication(session);

    const outcome = await disconnectGoogleAccount(db, user.id);
    if (!outcome.ok) {
      if (outcome.reason === "not_connected") {
        throw new ApiError("NOT_FOUND", "Google is not connected to this account.");
      }
      throw new ApiError(
        "AUTH_GOOGLE_DISCONNECT_BLOCKED",
        "Add a passkey before disconnecting Google — this account has no other usable sign-in method.",
      );
    }

    return jsonResponse(ok({ disconnected: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
