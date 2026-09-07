import type { APIRoute } from "astro";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { hashIp } from "../../../../lib/ip-hash";
import { recordSecurityEvent } from "../../../../lib/auth/rate-limit";
import {
  buildSessionCookie,
  createSession,
  getSessionAndUser,
  parseCookies,
  readSessionToken,
} from "../../../../lib/auth/session";
import { consumeOAuthIntent, hashNonce } from "../../../../lib/auth/oauth-intent";
import { verifyGoogleIdToken } from "../../../../lib/auth/google";
import {
  linkGoogleAccount,
  resolveGoogleSignIn,
  resolveOrCreateGoogleSignUp,
} from "../../../../lib/auth/google-account";
import { trackEvent } from "../../../../lib/analytics";

export const prerender = false;

const DEFAULT_FAILURE_REDIRECT = "/sign-in";

/**
 * Google's stable, small vocabulary of user-facing failure codes (section
 * 34) — appended as `?googleError=<code>` to the failure redirect. Never a
 * raw JWT/DB error, never a distinct code per specific verification check
 * (see google.ts's doc comment on why CSRF/state/token/nonce failures all
 * collapse into `google_invalid_request`).
 */
type GoogleCallbackErrorCode =
  | "google_invalid_request"
  | "google_not_linked"
  | "google_already_linked"
  | "google_account_unavailable"
  | "google_admin_passkey_required";

function redirectWithError(
  request: Request,
  destination: string,
  code: GoogleCallbackErrorCode,
): Response {
  const url = new URL(destination, request.url);
  url.searchParams.set("googleError", code);
  return new Response(null, { status: 303, headers: { Location: url.toString() } });
}

function redirectTo(
  request: Request,
  destination: string,
  params: Record<string, string> = {},
): Response {
  const url = new URL(destination, request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return new Response(null, { status: 303, headers: { Location: url.toString() } });
}

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

/**
 * POST /api/auth/google — Google's own server posts the ID-token credential
 * here after the user completes the GIS ceremony (section 14). This is a
 * genuinely cross-site POST by design (Google, not this origin, is the
 * caller), so it is deliberately exempt from `requireSession`'s
 * same-origin Origin/Referer check — protected instead by Google's own
 * `g_csrf_token` double-submit cookie, CrawlPact's one-time server-issued
 * `state`, the ID-token `nonce`, and full cryptographic token verification
 * (see docs/security/GOOGLE_AUTHENTICATION_THREAT_REVIEW.md). This
 * exception is scoped to this one route; no other endpoint weakens its
 * Origin check because of it.
 */
export const POST: APIRoute = async ({ request }) => {
  const db = createDb(getEnv().DB);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirectWithError(request, DEFAULT_FAILURE_REDIRECT, "google_invalid_request");
  }

  const credential = form.get("credential");
  const csrfField = form.get("g_csrf_token");
  const state = form.get("state");
  // `select_by` and any other field Google may add in the future are
  // intentionally ignored — a harmless new field must never break this
  // callback (section 14).

  const csrfCookie = parseCookies(request.headers.get("cookie"))["g_csrf_token"];

  if (typeof csrfField !== "string" || !csrfField || !csrfCookie || csrfField !== csrfCookie) {
    await logGoogleFailure(db, request, "google_csrf_mismatch");
    return redirectWithError(request, DEFAULT_FAILURE_REDIRECT, "google_invalid_request");
  }

  if (typeof state !== "string" || !state || typeof credential !== "string" || !credential) {
    await logGoogleFailure(db, request, "google_malformed_callback");
    return redirectWithError(request, DEFAULT_FAILURE_REDIRECT, "google_invalid_request");
  }

  const intent = await consumeOAuthIntent(db, state);
  if (!intent) {
    await logGoogleFailure(db, request, "google_invalid_state");
    return redirectWithError(request, DEFAULT_FAILURE_REDIRECT, "google_invalid_request");
  }

  const verified = await verifyGoogleIdToken(credential, {
    expectedClientId: getEnv().GOOGLE_CLIENT_ID,
  });
  if (!verified.ok) {
    await logGoogleFailure(db, request, `google_${verified.reason}`);
    return redirectWithError(request, intent.failureRedirect, "google_invalid_request");
  }

  const tokenNonce = verified.payload.nonce;
  if (!tokenNonce || (await hashNonce(tokenNonce)) !== intent.nonceHash) {
    await logGoogleFailure(db, request, "google_nonce_mismatch");
    return redirectWithError(request, intent.failureRedirect, "google_invalid_request");
  }

  if (intent.action === "link") {
    if (!intent.userId) {
      await logGoogleFailure(db, request, "google_link_intent_missing_user");
      return redirectWithError(request, intent.failureRedirect, "google_invalid_request");
    }
    // Re-derives the session from THIS request's own cookie rather than
    // trusting the intent's stored userId alone — the originating CrawlPact
    // session must still be valid, unrevoked, and belong to the same user
    // (section 22). A stale/expired/switched session fails closed.
    const token = readSessionToken(request);
    const sessionAndUser = token ? await getSessionAndUser(db, token) : null;
    if (!sessionAndUser || sessionAndUser.session.userId !== intent.userId) {
      await logGoogleFailure(db, request, "google_link_session_invalid", intent.userId);
      return redirectWithError(request, intent.failureRedirect, "google_invalid_request");
    }

    const linkOutcome = await linkGoogleAccount(db, {
      userId: intent.userId,
      sub: verified.payload.sub,
      email: verified.payload.email,
      emailVerified: verified.payload.emailVerified,
    });
    if (!linkOutcome.ok) {
      const code: GoogleCallbackErrorCode =
        linkOutcome.reason === "admin_requires_passkey"
          ? "google_admin_passkey_required"
          : "google_already_linked";
      await logGoogleFailure(db, request, `google_link_${linkOutcome.reason}`, intent.userId);
      return redirectWithError(request, intent.failureRedirect, code);
    }

    return redirectTo(request, intent.redirectTo, { googleLinked: "1" });
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
    const code: GoogleCallbackErrorCode =
      outcome.reason === "not_linked"
        ? "google_not_linked"
        : outcome.reason === "admin_requires_passkey"
          ? "google_admin_passkey_required"
          : "google_account_unavailable";
    return redirectWithError(request, intent.failureRedirect, code);
  }

  if (intent.action === "signup" && "created" in outcome && outcome.created) {
    await trackEvent(db, "account_created", { userId: outcome.userId });
  }

  // Google authentication never issues an admin session — SRS §28.20/section
  // 29's non-negotiable rule. `resolveGoogleSignIn`/`resolveOrCreateGoogleSignUp`
  // already refuse to authenticate any account with an active admin role at
  // all, so `isAdminSession` is unconditionally `false` here, not derived
  // from the resolved user (unlike passkey login/finish.ts, which computes
  // it — Google never should, even in principle).
  const { token, expiresAt } = await createSession(db, outcome.userId, {
    isAdminSession: false,
    userAgent: request.headers.get("user-agent"),
    ipHash: await hashIp(request),
  });

  const url = new URL(intent.redirectTo, request.url);
  return new Response(null, {
    status: 303,
    headers: { Location: url.toString(), "Set-Cookie": buildSessionCookie(token, expiresAt) },
  });
};
