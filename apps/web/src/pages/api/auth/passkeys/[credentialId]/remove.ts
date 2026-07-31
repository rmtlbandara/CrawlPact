import type { APIRoute } from "astro";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { removeCredential } from "../../../../../lib/auth/credentials";
import {
  requireRecentAuthentication,
  requireSession,
} from "../../../../../lib/auth/require-session";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

/**
 * POST /api/auth/passkeys/:credentialId/remove — "Remove passkeys" (SRS
 * §24). A sensitive action, so it requires recent re-authentication, and
 * it is refused outright if it would remove the account's last remaining
 * passkey (see removeCredential in credentials.ts).
 */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { session, user } = await requireSession(request, db);
    requireRecentAuthentication(session);

    const credentialId = params.credentialId;
    if (!credentialId) throw new ApiError("VALIDATION_FAILED", "Missing passkey id.");

    const result = await removeCredential(db, user.id, credentialId);
    if (!result.ok) {
      if (result.reason === "last_credential") {
        throw new ApiError(
          "VALIDATION_FAILED",
          "You cannot remove your only passkey. Add another one first, or delete your account instead.",
        );
      }
      if (result.reason === "admin_minimum_passkeys") {
        throw new ApiError(
          "VALIDATION_FAILED",
          "Administrator accounts must keep at least two registered passkeys. Add another one first.",
        );
      }
      throw new ApiError("NOT_FOUND", "This passkey does not exist.");
    }

    return jsonResponse(ok({ removed: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
