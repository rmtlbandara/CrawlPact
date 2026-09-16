import { SignJWT, importPKCS8 } from "jose";
import { fetchWithTimeout } from "./http";

/**
 * Google service-account OAuth (RFC 7523 JWT bearer grant), read only, for
 * the Search Console / GA4 read-only integration. This module is the *only*
 * place `GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON` is ever parsed — callers get
 * back a short-lived access token, never the credential itself.
 *
 * Uses `jose` (already a dependency — see `../auth/google.ts`, which uses it
 * for the opposite direction: verifying a Google-issued token rather than
 * signing one) instead of hand-written RS256 signing: both are thin
 * Web-Crypto wrappers, Workers-compatible, and reusing an existing
 * dependency here avoids a second, larger Google auth SDK for one JWT.
 *
 * Non-negotiable: never log, throw, or otherwise surface `private_key`, the
 * parsed credential object, the signed assertion, or the resulting access
 * token. Every error path below returns a closed-set `reason`, never the
 * underlying exception message.
 */

export const GOOGLE_SEARCH_CONSOLE_READONLY_SCOPE =
  "https://www.googleapis.com/auth/webmasters.readonly";
export const GOOGLE_ANALYTICS_READONLY_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
// Google rejects an assertion whose `exp` is more than one hour after `iat`.
const ASSERTION_TTL_SECONDS = 3600;
// Refresh ahead of actual expiry so a request never races a token that
// expires mid-flight.
const EXPIRY_SAFETY_MARGIN_MS = 5 * 60 * 1000;

type ServiceAccountCredential = {
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
};

export type ParseCredentialResult =
  | { ok: true; credential: ServiceAccountCredential }
  | { ok: false; reason: "missing" | "invalid_json" | "missing_fields" };

/**
 * Parses `GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON` defensively — never throws.
 * Requires `client_email` and `private_key`; `token_uri` falls back to
 * Google's standard token endpoint when absent (the downloaded service
 * account JSON always includes it, but this keeps a hand-built credential
 * document valid too).
 */
export function parseServiceAccountCredential(raw: string | undefined): ParseCredentialResult {
  if (!raw || raw.trim().length === 0) return { ok: false, reason: "missing" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: "invalid_json" };
  }

  const record = parsed as Record<string, unknown>;
  const clientEmail = typeof record.client_email === "string" ? record.client_email : "";
  const privateKey = typeof record.private_key === "string" ? record.private_key : "";
  const tokenUri =
    typeof record.token_uri === "string" && record.token_uri.length > 0
      ? record.token_uri
      : DEFAULT_TOKEN_URI;

  if (!clientEmail || !privateKey) {
    return { ok: false, reason: "missing_fields" };
  }

  return { ok: true, credential: { clientEmail, privateKey, tokenUri } };
}

async function createAssertion(
  credential: ServiceAccountCredential,
  scope: string,
): Promise<string> {
  const signingKey = await importPKCS8(credential.privateKey, "RS256");
  const nowSeconds = Math.floor(Date.now() / 1000);
  return new SignJWT({ scope })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(credential.clientEmail)
    .setAudience(credential.tokenUri)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + ASSERTION_TTL_SECONDS)
    .sign(signingKey);
}

export type AccessTokenResult =
  | { ok: true; accessToken: string; expiresAt: number }
  | {
      ok: false;
      reason: "not_configured" | "invalid_credential_json" | "token_exchange_failed";
    };

type CachedToken = { accessToken: string; expiresAt: number; cacheKey: string };
let cachedToken: CachedToken | null = null;

/**
 * Returns a short-lived (~1 hour) Google OAuth access token for the given
 * scopes, exchanging a fresh JWT assertion only when no cached token for
 * the same scope set + service account is still valid (with a safety
 * margin — see `EXPIRY_SAFETY_MARGIN_MS`). The cache is module-scope only
 * (an in-memory value, never D1/KV/R2) and lives only as long as this
 * Worker isolate does; a cold start simply re-exchanges.
 */
export async function getGoogleAccessToken(
  rawCredentialJson: string | undefined,
  scopes: string[],
): Promise<AccessTokenResult> {
  const parsed = parseServiceAccountCredential(rawCredentialJson);
  if (!parsed.ok) {
    return {
      ok: false,
      reason: parsed.reason === "missing" ? "not_configured" : "invalid_credential_json",
    };
  }

  const cacheKey = `${[...scopes].sort().join(" ")}|${parsed.credential.clientEmail}`;
  const now = Date.now();
  if (
    cachedToken &&
    cachedToken.cacheKey === cacheKey &&
    now < cachedToken.expiresAt - EXPIRY_SAFETY_MARGIN_MS
  ) {
    return { ok: true, accessToken: cachedToken.accessToken, expiresAt: cachedToken.expiresAt };
  }

  let assertion: string;
  try {
    assertion = await createAssertion(parsed.credential, scopes.join(" "));
  } catch {
    // A malformed `private_key` (present but not a valid PKCS8 PEM) fails
    // here, at signing time, rather than at the parse step above.
    return { ok: false, reason: "invalid_credential_json" };
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(parsed.credential.tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
  } catch {
    return { ok: false, reason: "token_exchange_failed" };
  }

  if (!response.ok) {
    return { ok: false, reason: "token_exchange_failed" };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: "token_exchange_failed" };
  }

  const record = body as Record<string, unknown>;
  const accessToken = typeof record.access_token === "string" ? record.access_token : "";
  const expiresIn = typeof record.expires_in === "number" ? record.expires_in : 0;
  if (!accessToken || expiresIn <= 0) {
    return { ok: false, reason: "token_exchange_failed" };
  }

  const expiresAt = now + expiresIn * 1000;
  cachedToken = { accessToken, expiresAt, cacheKey };
  return { ok: true, accessToken, expiresAt };
}

/**
 * Clears the module-scope token cache. Exported only so tests can isolate
 * cache behaviour between cases (each Worker isolate would otherwise only
 * ever see this reset by a cold start); never called from production code.
 */
export function resetGoogleAccessTokenCacheForTests(): void {
  cachedToken = null;
}
