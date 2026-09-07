import { ApiError } from "@crawlpact/core";
import { getEnv } from "../env";

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
 */
export function assertSameOrigin(request: Request): void {
  if (SAFE_METHODS.has(request.method)) return;

  const expectedOrigin = new URL(getEnv().PUBLIC_SITE_URL).origin;
  const origin = request.headers.get("Origin");
  if (origin) {
    if (origin !== expectedOrigin) {
      throw new ApiError("FORBIDDEN", "Cross-site request blocked.");
    }
    return;
  }

  const referer = request.headers.get("Referer");
  if (referer && new URL(referer).origin === expectedOrigin) return;

  throw new ApiError("FORBIDDEN", "Cross-site request blocked.");
}
