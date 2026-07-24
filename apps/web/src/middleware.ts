import { defineMiddleware } from "astro:middleware";
import { getEnv } from "./lib/env";

/**
 * Security response headers applied to every request (SRS §33, Part 2
 * Step 19). Astro SSR responses don't go through `public/_headers` (that
 * file only covers static assets on Cloudflare's Workers Assets binding),
 * so this is the one place that must set them for every rendered page and
 * API response.
 *
 * The CSP here allows `'unsafe-inline'` for scripts/styles because Astro's
 * island-hydration bootstrap and Tailwind's runtime both emit inline
 * `<script>`/`style` content with no nonce support wired up yet — a
 * disclosed, real limitation (see docs/security/THREAT_MODEL.md), not a
 * silently-accepted gap. It still blocks loading script/style/frame
 * content from any origin other than this site and Paddle's checkout.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  const isLocal = getEnv().PUBLIC_APP_ENV === "local";

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.paddle.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.paddle.com",
    "frame-src https://*.paddle.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(self)",
  );
  if (!isLocal) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
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
