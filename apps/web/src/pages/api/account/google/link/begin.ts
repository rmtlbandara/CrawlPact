import type { APIRoute } from "astro";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import {
  requireRecentAuthentication,
  requireSession,
} from "../../../../../lib/auth/require-session";
import { isAdminAccount } from "../../../../../lib/auth/google-account";
import { createGoogleLinkIntent } from "../../../../../lib/auth/oauth-intent";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

// Linking always starts and ends on Account settings, so there is no
// client-supplied redirect destination to validate here. ADR-0009's
// corrected transport (JSON callback, not a page redirect) means the
// callback returns `redirectTo` directly in its JSON response on success
// and a normal API error on failure — `failureRedirect` is still stored on
// the intent row (unused schema field kept from the pre-correction design
// rather than a migration for this alone) but no longer read.
const ACCOUNT_SETTINGS_PATH = "/app/account";

/**
 * POST /api/account/google/link/begin — authenticated, requires recent
 * authentication (connecting a new sign-in method is a sensitive action,
 * same step-up bar as recovery-code regeneration/passkey removal — section
 * 22). `userId` for the resulting intent is derived from the session,
 * never from the request body (section 13's non-negotiable rule).
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user, session } = await requireSession(request, db);
    requireRecentAuthentication(session);

    if (await isAdminAccount(db, user.id)) {
      throw new ApiError(
        "AUTH_GOOGLE_ADMIN_REQUIRES_PASSKEY",
        "Administrator accounts cannot connect Google sign-in.",
      );
    }

    const { nonce, state } = await createGoogleLinkIntent(db, {
      userId: user.id,
      redirectTo: ACCOUNT_SETTINGS_PATH,
      failureRedirect: ACCOUNT_SETTINGS_PATH,
    });

    return jsonResponse(ok({ nonce, state }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
