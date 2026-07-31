import { defineMiddleware } from "astro:middleware";
import { getEnv } from "./lib/env";
import {
  CSP_HEADER_VALUE,
  HSTS_VALUE,
  PERMISSIONS_POLICY_VALUE,
  REFERRER_POLICY_VALUE,
  X_CONTENT_TYPE_OPTIONS_VALUE,
  X_FRAME_OPTIONS_VALUE,
} from "./lib/security-headers";

/**
 * Security response headers applied to every SSR request (SRS §33, Part 2
 * Step 19). Prerendered marketing pages (home, pricing, guides, etc.) are
 * static HTML served directly off the Workers Assets binding and never run
 * this middleware at all — `apps/web/public/_headers` carries the same
 * headers for those, since a live production check found the site's own
 * homepage shipping with zero security headers otherwise. Both read the
 * same constants from `lib/security-headers.ts`; `_headers` can't import
 * that module directly (it's a static file Cloudflare reads, not code), so
 * `lib/security-headers.test.ts` asserts the two stay in sync instead.
 *
 * The CSP here allows `'unsafe-inline'` for scripts/styles because Astro's
 * island-hydration bootstrap and Tailwind's runtime both emit inline
 * `<script>`/`style` content with no nonce support wired up yet — a
 * disclosed, real limitation (see docs/security/THREAT_MODEL.md), not a
 * silently-accepted gap. It still blocks loading script/style/frame
 * content from any origin other than this site, Paddle's checkout, and
 * Google Analytics (an explicit, authorised deviation from SRS §6.2's
 * "no external analytics vendors" — see docs/status/KNOWN_RISKS.md).
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  const isLocal = getEnv().PUBLIC_APP_ENV === "local";

  response.headers.set("Content-Security-Policy", CSP_HEADER_VALUE);
  response.headers.set("X-Content-Type-Options", X_CONTENT_TYPE_OPTIONS_VALUE);
  response.headers.set("X-Frame-Options", X_FRAME_OPTIONS_VALUE);
  response.headers.set("Referrer-Policy", REFERRER_POLICY_VALUE);
  response.headers.set("Permissions-Policy", PERMISSIONS_POLICY_VALUE);
  if (!isLocal) {
    response.headers.set("Strict-Transport-Security", HSTS_VALUE);
  }

  // SRS §30.3: private, admin, authenticated-app, and arbitrary-report
  // routes must never be indexable. Several per-page `<meta name="robots">`
  // tags already cover this for HTML (AdminLayout.astro, AppLayout.astro,
  // and individual pages' `noindex` prop), but that only works for HTML
  // responses — every route under /api/ returns JSON with no <head> to
  // carry a meta tag at all, so this header is the only mechanism that
  // covers them. It's also a second, content-type-independent guarantee
  // for the HTML routes that already set the meta tag (defence in depth).
  const path = context.url.pathname;
  const isNonIndexableRoute =
    path.startsWith("/admin") ||
    path.startsWith("/api/") ||
    path.startsWith("/app") ||
    path.startsWith("/audit/") ||
    path.startsWith("/shared/") ||
    path.startsWith("/dev/") ||
    path === "/sign-in";
  if (isNonIndexableRoute) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  return response;
});
