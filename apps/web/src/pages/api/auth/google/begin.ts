import type { APIRoute } from "astro";
import { ApiError, beginGoogleAuthRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { isSafeRelativeRedirect } from "../../../../lib/auth/safe-redirect";
import { createGoogleAuthIntents } from "../../../../lib/auth/oauth-intent";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

const DEFAULT_REDIRECT = "/app";
const DEFAULT_FAILURE_REDIRECT = "/sign-in";

/**
 * POST /api/auth/google/begin — unauthenticated. Creates the paired
 * sign-in/sign-up OAuth intents (section 13) `/sign-in`'s two Google
 * buttons need, sharing one GIS nonce. `redirectTo`/`failureRedirect` are
 * whatever `/sign-in` already computed for its own passkey flow (audit
 * continuation, pricing continuity, or the `/app` default) — re-validated
 * here with the same `isSafeRelativeRedirect` check used everywhere else,
 * never trusted outright from the request body.
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = beginGoogleAuthRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Malformed request.", {
        issues: parsed.error.issues,
      });
    }

    const redirectTo = isSafeRelativeRedirect(parsed.data.redirectTo)
      ? parsed.data.redirectTo
      : DEFAULT_REDIRECT;
    const failureRedirect = isSafeRelativeRedirect(parsed.data.failureRedirect)
      ? parsed.data.failureRedirect
      : DEFAULT_FAILURE_REDIRECT;

    const db = createDb(getEnv().DB);
    const { nonce, signInState, signUpState } = await createGoogleAuthIntents(db, {
      redirectTo,
      failureRedirect,
    });

    return jsonResponse(ok({ nonce, signInState, signUpState }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
