import type { APIRoute } from "astro";
import { ApiError, googleCallbackRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { hashIp } from "../../../../lib/ip-hash";
import { recordSecurityEvent } from "../../../../lib/auth/rate-limit";
import { assertSameOrigin } from "../../../../lib/auth/same-origin";
import { requireSession } from "../../../../lib/auth/require-session";
import { buildSessionCookie, createSession } from "../../../../lib/auth/session";
import { consumeOAuthIntent, hashNonce } from "../../../../lib/auth/oauth-intent";
import { verifyGoogleIdToken } from "../../../../lib/auth/google";
import {
  linkGoogleAccount,
  resolveGoogleSignIn,
  resolveOrCreateGoogleSignUp,
} from "../../../../lib/auth/google-account";
import { trackEvent } from "../../../../lib/analytics";
import {
  jsonErrorResponse,
  jsonResponse,
  jsonResponseWithCookie,
} from "../../../../lib/json-response";

export const prerender = false;

/**
 * POST /api/auth/google — the corrected ADR-0009 transport (see the
 * superseding note in that ADR). Google Identity Services is configured in
 * JavaScript-callback mode (`ux_mode: "popup"`, `google-identity.ts`), so
 * Google itself never posts here — the CrawlPact page does, as a same-origin
 * JSON `fetch()` after GIS hands it a `CredentialResponse` in-browser. This
 * is therefore an ordinary same-origin mutating endpoint, protected exactly
 * like any other: `assertSameOrigin` (Origin/Referer, same helper
 * `requireSession` uses), plus three more independent layers specific to
 * the Google ceremony itself — a one-time server-issued `state`
 * (`oauth_auth_intents`, hashed), the ID-token `nonce` (hashed, bound to
 * that same intent), and full cryptographic Google ID-token verification
 * (`google.ts`). There is no cross-site caller to defend against anymore,
 * so there is nothing here resembling Google's old `g_csrf_token`
 * double-submit mechanism — that belonged to the old (defective) direct
 * form-POST transport, not this one.
 */
async function logGoogleFailure(
  db: ReturnType<typeof createDb>,
  request: Request,
  reason: string,
  userId?: string | null,
): Promise<void> {
  const ipHash = await hashIp(request);
  await recordSecurityEvent(db, "auth_failure", {
    userId: userId ?? null,
    ipHash,
    details: { reason },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);

  try {
    assertSameOrigin(request);

    const body = await request.json().catch(() => {
      throw new ApiError("VALIDATION_FAILED", "Request body must be valid JSON.");
    });
    const parsed = googleCallbackRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Malformed Google credential response.", {
        issues: parsed.error.issues,
      });
    }
    const { credential, state } = parsed.data;

    const intent = await consumeOAuthIntent(db, state);
    if (!intent) {
      await logGoogleFailure(db, request, "google_invalid_state");
      throw new ApiError(
        "AUTH_GOOGLE_INVALID_REQUEST",
        "Google sign-in could not be completed. Please try again, or use a passkey.",
      );
    }

    const verified = await verifyGoogleIdToken(credential, {
      expectedClientId: getEnv().GOOGLE_CLIENT_ID,
    });
    if (!verified.ok) {
      await logGoogleFailure(db, request, `google_${verified.reason}`);
      throw new ApiError(
        "AUTH_GOOGLE_INVALID_REQUEST",
        "Google sign-in could not be completed. Please try again, or use a passkey.",
      );
    }

    const tokenNonce = verified.payload.nonce;
    if (!tokenNonce || (await hashNonce(tokenNonce)) !== intent.nonceHash) {
      await logGoogleFailure(db, request, "google_nonce_mismatch");
      throw new ApiError(
        "AUTH_GOOGLE_INVALID_REQUEST",
        "Google sign-in could not be completed. Please try again, or use a passkey.",
      );
    }

    if (intent.action === "link") {
      if (!intent.userId) {
        await logGoogleFailure(db, request, "google_link_intent_missing_user");
        throw new ApiError(
          "AUTH_GOOGLE_INVALID_REQUEST",
          "Google sign-in could not be completed. Please try again, or use a passkey.",
        );
      }
      // The link callback is itself an authenticated same-origin request now
      // (the page that started the link ceremony makes this fetch with its
      // own session cookie, `credentials: "same-origin"`) — `requireSession`
      // is the correct, established chokepoint for "is there a valid,
      // unrevoked session," not a hand-rolled cookie/session lookup.
      const { user } = await requireSession(request, db);
      if (user.id !== intent.userId) {
        await logGoogleFailure(db, request, "google_link_session_invalid", intent.userId);
        throw new ApiError(
          "AUTH_GOOGLE_INVALID_REQUEST",
          "Google sign-in could not be completed. Please try again, or use a passkey.",
        );
      }

      const linkOutcome = await linkGoogleAccount(db, {
        userId: intent.userId,
        sub: verified.payload.sub,
        email: verified.payload.email,
        emailVerified: verified.payload.emailVerified,
      });
      if (!linkOutcome.ok) {
        await logGoogleFailure(db, request, `google_link_${linkOutcome.reason}`, intent.userId);
        if (linkOutcome.reason === "admin_requires_passkey") {
          throw new ApiError(
            "AUTH_GOOGLE_ADMIN_REQUIRES_PASSKEY",
            "Administrator accounts cannot connect Google sign-in.",
          );
        }
        throw new ApiError(
          "AUTH_GOOGLE_ALREADY_LINKED",
          "This Google account is already connected to another CrawlPact account.",
        );
      }

      return jsonResponse(ok({ redirectTo: intent.redirectTo }, requestId), 200);
    }

    // signin / signup share the same post-resolution session-issuance path.
    const outcome =
      intent.action === "signup"
        ? await resolveOrCreateGoogleSignUp(db, {
            sub: verified.payload.sub,
            email: verified.payload.email,
            emailVerified: verified.payload.emailVerified,
            name: verified.payload.name,
          })
        : await resolveGoogleSignIn(db, {
            sub: verified.payload.sub,
            email: verified.payload.email,
            emailVerified: verified.payload.emailVerified,
          });

    if (!outcome.ok) {
      await logGoogleFailure(db, request, `google_${intent.action}_${outcome.reason}`);
      if (outcome.reason === "not_linked") {
        throw new ApiError(
          "AUTH_GOOGLE_NOT_LINKED",
          "No CrawlPact account is connected to that Google account. Choose Create account to make a new account, or sign in with your existing passkey and connect Google from Account settings.",
        );
      }
      if (outcome.reason === "admin_requires_passkey") {
        throw new ApiError(
          "AUTH_GOOGLE_ADMIN_REQUIRES_PASSKEY",
          "Administrator accounts must sign in with a passkey.",
        );
      }
      throw new ApiError("AUTH_GOOGLE_ACCOUNT_UNAVAILABLE", "This account is not available.");
    }

    if (intent.action === "signup" && "created" in outcome && outcome.created) {
      await trackEvent(db, "account_created", { userId: outcome.userId });
    }

    // Google authentication never issues an admin session — SRS §28.20/
    // section 29's non-negotiable rule. `resolveGoogleSignIn`/
    // `resolveOrCreateGoogleSignUp` already refuse to authenticate any
    // account with an active admin role at all, so `isAdminSession` is
    // unconditionally `false` here, not derived from the resolved user
    // (unlike passkey login/finish.ts, which does compute it — Google
    // never should, even in principle).
    const { token, expiresAt } = await createSession(db, outcome.userId, {
      isAdminSession: false,
      userAgent: request.headers.get("user-agent"),
      ipHash: await hashIp(request),
    });

    return jsonResponseWithCookie(
      ok({ redirectTo: intent.redirectTo }, requestId),
      200,
      buildSessionCookie(token, expiresAt),
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
