import { ApiError } from "@crawlpact/core";
import { getValidatedRequestOrigin } from "../origin";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence-in-depth (SRS §33). Shared by every mutating same-origin
 * endpoint — `requireSession` (for ordinary authenticated routes) and the
 * Google callback (`pages/api/auth/google/index.ts`, ADR-0009's corrected
 * transport: a same-origin JSON `fetch()` from the CrawlPact page, not a
 * cross-site POST from Google itself). Session cookies are already
 * `SameSite=Lax` (session.ts), which blocks cross-site POST/PATCH/DELETE in
 * every modern browser — this Origin/Referer check is a second, independent
 * layer, in case of a `SameSite` bypass or a non-browser client that ignores
 * it. Read-only requests are exempt: there's nothing for a forged request to
 * achieve by only reading data.
 *
 * Phase 2 of the app-subdomain migration (ADR-0010) replaced the previous
 * single-`PUBLIC_SITE_URL` expected origin with a **self-referential** check:
 * the expected origin is whichever of our currently trusted origins
 * (`lib/origin.ts` — the public origin, and the app origin once
 * `PUBLIC_APP_URL` is configured) the request itself arrived on, never a
 * fixed value. This is deliberately NOT the same as accepting either trusted
 * origin unconditionally — a request that arrives on
 * `https://app.crawlpact.com` but claims `Origin: https://crawlpact.com` (or
 * the reverse) is rejected exactly like an attacker origin would be, because
 * the check is always "does Origin match *this request's own* arrival
 * origin," never "is Origin *any* of our origins." An unrecognized arrival
 * origin (a Host our config doesn't know about) yields `null` from
 * `getValidatedRequestOrigin`, which can never equal any `Origin` header —
 * closing the request unconditionally, the correct fail-closed behavior for
 * a hostname we don't trust in the first place.
 */
export function assertSameOrigin(request: Request): void {
  if (SAFE_METHODS.has(request.method)) return;

  const expectedOrigin = getValidatedRequestOrigin(request);

  const origin = request.headers.get("Origin");
  if (origin) {
    if (!expectedOrigin || origin !== expectedOrigin) {
      throw new ApiError("FORBIDDEN", "Cross-site request blocked.");
    }
    return;
  }

  const referer = request.headers.get("Referer");
  if (expectedOrigin && referer) {
    let refererOrigin: string;
    try {
      refererOrigin = new URL(referer).origin;
    } catch {
      throw new ApiError("FORBIDDEN", "Cross-site request blocked.");
    }
    if (refererOrigin === expectedOrigin) return;
  }

  throw new ApiError("FORBIDDEN", "Cross-site request blocked.");
}
