/**
 * Phase 13: analytics consent architecture (RISK-021). A global opt-in, not
 * geography-based detection — see docs/analytics/CONSENT_AND_ANALYTICS_PREFERENCE_MODEL.md
 * for the full reasoning. This module is the single source of truth for the
 * cookie name/format/version and the Google-Analytics route policy, shared
 * by server-side rendering (GoogleAnalytics.astro, MarketingLayout.astro)
 * and the client-side consent island (AnalyticsConsent.tsx) — the two must
 * never independently reimplement this logic and risk drifting apart.
 */

export const ANALYTICS_CONSENT_COOKIE = "crawlpact_analytics_consent";

/**
 * Bump this and consent is re-requested on next visit. Only bump for a
 * material change to what analytics does or which third party is involved —
 * never for a copy-only edit to the consent banner text.
 */
export const ANALYTICS_CONSENT_VERSION = 1;

export type AnalyticsConsentState = "granted" | "denied";

/** Cookie value format: "<state>.v<version>", e.g. "granted.v1". */
export function encodeConsentCookieValue(state: AnalyticsConsentState): string {
  return `${state}.v${ANALYTICS_CONSENT_VERSION}`;
}

/**
 * Returns the consent state only when the cookie's version matches the
 * current ANALYTICS_CONSENT_VERSION — a stale-version cookie (from before a
 * material change) is treated as "no decision made yet", not as its old
 * value, so the visitor is re-prompted rather than silently carried forward
 * on an outdated basis.
 */
export function parseConsentCookieValue(
  raw: string | undefined | null,
): AnalyticsConsentState | null {
  if (!raw) return null;
  const match = /^(granted|denied)\.v(\d+)$/.exec(raw);
  if (!match) return null;
  const [, state, versionStr] = match;
  if (Number(versionStr) !== ANALYTICS_CONSENT_VERSION) return null;
  return state as AnalyticsConsentState;
}

/**
 * GA route policy (SRS-independent product decision, see
 * docs/analytics/GOOGLE_ANALYTICS_SCOPE_POLICY.md for the full route matrix
 * and rationale for each exclusion). Deliberately an explicit allowlist, not
 * "every MarketingLayout page" — several MarketingLayout pages carry private
 * or low-value-to-measure content and must never receive GA regardless of
 * consent: /pay (billing), /shared/[token] (private shared reports),
 * /audit/[auditId] (a specific audit result, a private-ish identifier), and
 * /privacy /terms /security /contact /status /acceptable-use /sign-in /404
 * (legal/infra pages where marketing measurement adds no product value).
 */
const GA_ALLOWED_EXACT = new Set([
  "/",
  "/pricing",
  "/about",
  "/methodology",
  "/limitations",
  "/scoring",
  "/changelog",
  "/scanner",
  "/sample-report",
  "/audit",
]);

const GA_ALLOWED_PREFIXES = ["/for/", "/platforms/", "/crawlers/", "/guides/", "/tools/"];

export function isGaEligibleRoute(pathname: string): boolean {
  // Normalize a trailing slash (Astro's Cloudflare Assets binding
  // 307-redirects extension-less paths to their trailing-slash form — see
  // docs/status/KNOWN_RISKS.md) so "/pricing/" and "/pricing" match alike.
  const normalized =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const withRootSlash = normalized === "" ? "/" : normalized;
  if (GA_ALLOWED_EXACT.has(withRootSlash)) return true;
  return GA_ALLOWED_PREFIXES.some((prefix) => withRootSlash.startsWith(prefix));
}
