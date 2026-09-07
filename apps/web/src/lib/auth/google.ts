import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JWTVerifyGetKey } from "jose";

/**
 * Server-side verification of a Google Identity Services ID token (ADR-0009).
 * This is the *only* place CrawlPact trusts a Google-asserted identity — the
 * result of `verifyGoogleIdToken` is the sole input `google-account.ts` uses
 * to resolve/create/link a CrawlPact user. Never decode-and-trust a JWT
 * payload anywhere else; always route through this module.
 *
 * Uses `jose` (Web Crypto based, Cloudflare Workers-compatible) rather than
 * hand-written signature verification. The JWKS resolver is
 * dependency-injectable so unit tests can supply a local, in-memory keyset
 * instead of depending on Google's network (see google.test.ts) — production
 * code always uses the default, which fetches and caches Google's real
 * current signing keys via `jose`'s own safe caching (`createRemoteJWKSet`
 * only re-fetches on a `kid` miss, not on every call).
 */

// Google's stable JWKS endpoint for ID token verification — see
// https://developers.google.com/identity/openid-connect/openid-connect#discovery
// (the discovery document's own `jwks_uri` resolves to this same URL; it is
// fetched directly here to avoid an extra discovery round trip).
const GOOGLE_JWKS_URL = new URL("https://www.googleapis.com/oauth2/v3/certs");

// Module-scope singleton so the process-lifetime cache `createRemoteJWKSet`
// keeps internally is actually reused across requests, not rebuilt (and its
// cache discarded) on every call.
let defaultJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getDefaultJwks(): ReturnType<typeof createRemoteJWKSet> {
  defaultJwks ??= createRemoteJWKSet(GOOGLE_JWKS_URL);
  return defaultJwks;
}

// Google issues ID tokens with either of these `iss` values depending on
// token version — both are documented as valid and must be accepted.
const ACCEPTED_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

export type GoogleIdTokenPayload = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  /**
   * The token's raw `nonce` claim, if present — deliberately NOT validated
   * against anything here. CrawlPact only ever persists a SHA-256 hash of
   * the nonce it issued (see `oauth-intent.ts`), never the raw value, so
   * the nonce-matches-intent check has to happen one level up: the caller
   * hashes this field and compares it to the stored `nonceHash` on the
   * `oauth_auth_intents` row the `state` parameter resolved to. Keeping
   * that comparison out of this module keeps it focused on cryptographic
   * token verification only, with no DB dependency.
   */
  nonce: string | null;
};

export type VerifyGoogleIdTokenResult =
  | { ok: true; payload: GoogleIdTokenPayload }
  | {
      ok: false;
      reason:
        | "invalid_token" // malformed, bad signature, unknown key, wrong algorithm, wrong issuer/audience, expired, not-yet-valid
        | "missing_subject"
        | "azp_mismatch";
    };

/**
 * Verifies a raw Google ID token string's signature, issuer, audience,
 * expiration and `azp` (when present) against `expectedClientId` (the
 * configured `GOOGLE_CLIENT_ID`). Does not check the `nonce` claim — see
 * `GoogleIdTokenPayload.nonce`'s doc comment for why that's the caller's
 * job. Every failure collapses to one of a small number of reasons; callers
 * must map all of them (and a caller-side nonce mismatch) to the same
 * generic `AUTH_GOOGLE_INVALID_REQUEST` user-facing error — never disclose
 * which specific check failed (see
 * docs/security/GOOGLE_AUTHENTICATION_THREAT_REVIEW.md).
 */
export async function verifyGoogleIdToken(
  idToken: string,
  options: {
    expectedClientId: string;
    jwks?: JWTVerifyGetKey;
  },
): Promise<VerifyGoogleIdTokenResult> {
  const jwks = options.jwks ?? getDefaultJwks();

  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(idToken, jwks, {
      issuer: ACCEPTED_ISSUERS,
      audience: options.expectedClientId,
      algorithms: ["RS256"],
      // A few seconds of leeway for ordinary clock drift between this
      // Worker and Google's token-issuance time — not a broad tolerance.
      clockTolerance: 5,
    });
    payload = result.payload;
  } catch {
    // jose throws a typed error per failure mode (bad signature, unknown
    // kid, wrong alg, wrong iss/aud, expired, not-yet-valid); all of them
    // collapse to the same generic outcome here by design (see doc comment
    // above) — the specific jose error is not inspected or logged.
    return { ok: false, reason: "invalid_token" };
  }

  const sub = typeof payload["sub"] === "string" ? payload["sub"] : "";
  if (!sub) return { ok: false, reason: "missing_subject" };

  // `azp` ("authorized party") is only present on some Google ID tokens; per
  // Google's own verification guidance, when present it must equal the
  // configured client ID (it is meant to catch a token issued for a
  // different, cooperating client than the one presenting it here).
  const azp = typeof payload["azp"] === "string" ? payload["azp"] : null;
  if (azp !== null && azp !== options.expectedClientId) {
    return { ok: false, reason: "azp_mismatch" };
  }

  const email = typeof payload["email"] === "string" ? payload["email"] : null;
  const emailVerified = payload["email_verified"] === true;
  const name = typeof payload["name"] === "string" ? payload["name"] : null;
  const nonce = typeof payload["nonce"] === "string" ? payload["nonce"] : null;

  return { ok: true, payload: { sub, email, emailVerified, name, nonce } };
}
