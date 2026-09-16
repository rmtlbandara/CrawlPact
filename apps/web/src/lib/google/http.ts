/**
 * Shared HTTP plumbing for the Google Search Console / GA4 / CrUX
 * read-only integration (`../admin/google-insights.ts` and its three
 * provider clients). These calls hit fixed, admin-configured Google API
 * endpoints — never a customer-supplied URL — so they deliberately do not
 * go through `packages/scanner`'s `safeFetch` chokepoint (ADR-0005 scopes
 * that chokepoint to customer-supplied targets only). Bounded timeout via
 * `AbortController`, matching `safeFetch`'s own pattern.
 */

export const GOOGLE_REQUEST_TIMEOUT_MS = 10_000;

/**
 * A small, closed set of outcomes every provider client collapses its
 * failures into — deliberately coarse (see each client's own comment for
 * exactly which HTTP statuses map to which reason) so a diagnostic
 * endpoint can report *what kind* of thing went wrong without ever
 * forwarding a raw provider error body.
 */
export type GoogleReadFailureReason =
  | "not_configured"
  | "invalid_credential_json"
  | "token_exchange_failed"
  | "auth_failed"
  | "permission_denied"
  | "rate_limited"
  | "upstream_unavailable"
  | "upstream_error";

export type GoogleReadResult<T> =
  { status: "ok"; data: T } | { status: "no_data" } | { status: GoogleReadFailureReason };

/**
 * `fetch` with a bounded timeout. Never include a secret-bearing URL
 * (e.g. CrUX's `?key=...`) or an `Authorization` header value in anything
 * thrown or returned from a caller wrapping this — this function itself
 * never logs or echoes its inputs.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = GOOGLE_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Maps a Google JSON API's HTTP status to the shared failure taxonomy.
 * `unauthorized` (401) and `forbidden` (403) both indicate an auth/permission
 * problem — kept as two reasons (`auth_failed` for 401, `permission_denied`
 * for 403) since a 401 usually means the token itself is bad/expired while a
 * 403 usually means the token is valid but lacks access to this specific
 * resource (e.g. the service account was never granted Search Console
 * "Restricted" access on this property) — a real, actionable distinction
 * for whoever reads this diagnostic.
 */
export function classifyHttpFailure(status: number): GoogleReadFailureReason {
  if (status === 401) return "auth_failed";
  if (status === 403) return "permission_denied";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "upstream_unavailable";
  return "upstream_error";
}

export type GoogleJsonResult =
  | { ok: true; body: unknown }
  | { ok: false; status: GoogleReadFailureReason; httpStatus: number | null };

/**
 * The fetch → timeout → status-classify → JSON-parse sequence every one of
 * the three provider clients needs, factored out so it's implemented (and
 * reviewed) once rather than three times. `httpStatus` is exposed on
 * failure so a caller with its own special-case status (CrUX's legitimate
 * 404 "no data" response, distinct from a real failure) can still branch
 * on it before falling back to the shared classification.
 */
export async function fetchGoogleJson(
  url: string,
  init: RequestInit,
  timeoutMs?: number,
): Promise<GoogleJsonResult> {
  let response: Response;
  try {
    response = await fetchWithTimeout(url, init, timeoutMs);
  } catch {
    return { ok: false, status: "upstream_unavailable", httpStatus: null };
  }

  if (!response.ok) {
    return { ok: false, status: classifyHttpFailure(response.status), httpStatus: response.status };
  }

  try {
    return { ok: true, body: await response.json() };
  } catch {
    return { ok: false, status: "upstream_error", httpStatus: response.status };
  }
}
