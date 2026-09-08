/**
 * Single source of truth for the security response headers this site sends
 * (SRS §33). `middleware.ts` applies these to every SSR response. Prerendered
 * marketing pages never run middleware — they're static HTML served off the
 * Workers Assets binding — so `apps/web/public/_headers` must carry the same
 * values for those. `_headers` is a static file Cloudflare reads directly and
 * can't import this module, so `security-headers.test.ts` asserts its
 * contents match these constants instead, turning silent drift between the
 * two into a failing test rather than an unnoticed gap.
 */
export const CSP_HEADER_VALUE = [
  "default-src 'self'",
  // ADR-0009 (Google federated authentication): only Google's official GIS
  // origins are added, exactly matching Google's own documented CSP
  // guidance (developers.google.com/identity/gsi/web/guides) — no broad
  // `*.google.com`/`https:` shortcut. `object-src`/`base-uri`/`frame-ancestors`/
  // `form-action` are unchanged by this addition.
  // Phase 22: Microsoft Clarity's own official CSP guidance
  // (learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-csp)
  // recommends `https://*.clarity.ms` and `https://c.bing.com` — Clarity
  // load-balances data collection across lettered subdomains
  // (a.clarity.ms..z.clarity.ms), so the wildcard is Microsoft's own
  // documented minimum, not a broad shortcut chosen locally.
  "script-src 'self' 'unsafe-inline' https://cdn.paddle.com https://www.googletagmanager.com https://accounts.google.com/gsi/client https://www.clarity.ms",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.paddle.com https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://accounts.google.com/gsi/ https://*.clarity.ms https://c.bing.com",
  "frame-src https://*.paddle.com https://accounts.google.com/gsi/",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

export const X_CONTENT_TYPE_OPTIONS_VALUE = "nosniff";
export const X_FRAME_OPTIONS_VALUE = "DENY";
export const REFERRER_POLICY_VALUE = "strict-origin-when-cross-origin";
export const PERMISSIONS_POLICY_VALUE = "camera=(), microphone=(), geolocation=(), payment=(self)";
export const HSTS_VALUE = "max-age=63072000; includeSubDomains; preload";
