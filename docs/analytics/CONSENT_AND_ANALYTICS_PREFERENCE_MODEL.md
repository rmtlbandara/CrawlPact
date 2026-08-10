# Consent and Analytics Preference Model

**Level 2 document.** Phase 13 (RISK-021). Closes the gap where Google Analytics set tracking
cookies on public marketing pages with zero consent gating.

## Model: global opt-in, not geography-based

A single global choice — accept or decline — applies everywhere, with no visitor-country
inference, no new geolocation architecture, and no regional variation. This is simpler, easier to
explain and test, and avoids accidental regional misclassification. **This does not by itself
guarantee compliance with any specific jurisdiction's consent law** — it is a deliberate,
disclosed simplification, not a legal conclusion.

## Cookie

`crawlpact_analytics_consent` — first-party, non-`HttpOnly` (must be readable by the client-side
consent script), `SameSite=Lax`, `Secure` in production, `Path=/`, `Max-Age` ≈ 182 days (~6
months — a privacy-minimising duration; no current approved policy specifies a different one).

Value format: `"<granted|denied>.v<version>"`, e.g. `"granted.v1"`. Never stores a user ID, email,
domain, IP, GA client ID, or advertising ID — only the choice and the policy version it applies to.

## Consent versioning

`ANALYTICS_CONSENT_VERSION` (`apps/web/src/lib/consent.ts`) = `1` at launch. A cookie whose
version doesn't match the current constant is treated as "no decision made" and the visitor is
re-prompted — this only happens when the constant is deliberately bumped for a material change to
what analytics does or which third party is involved, never for a copy-only edit to the consent
banner text.

## Behaviour

- **Before any choice**: Google Analytics is not loaded, no Google request is made, no `_ga`
  cookie exists. This is a real technical block — `GoogleAnalytics.astro` is conditionally
  rendered server-side on `consentState === "granted"`, and the client-side script that would
  otherwise be injected on accept is never invoked until the visitor actually clicks Accept. GA's
  own `<script>` tags do not exist in the DOM at all pre-consent, not merely "a cookie says no
  while gtag.js still loads."
- **Accept**: cookie set to `granted`; if the current route is GA-eligible
  (`docs/analytics/GOOGLE_ANALYTICS_SCOPE_POLICY.md`), GA is loaded immediately client-side
  without a page reload.
- **Decline**: cookie set to `denied`; GA remains unloaded. If GA was somehow already loaded on
  this page (e.g. a returning visitor whose SSR-rendered page had it, then declines via the
  preferences panel), `gtag("consent", "update", { analytics_storage: "denied" })` is called and
  any `_ga*`-prefixed cookie on this domain is cleared.
- **Declining has no effect on using CrawlPact** — no consent wall, no feature gating tied to this
  cookie.
- **Reload**: the SSR path re-reads the cookie on every request, so the choice is respected
  immediately, without needing client-side state to survive a navigation.
- **Revoke**: the same UI used for the first-visit choice is reachable at any time via a
  persistent "Analytics preferences" control (bottom-left of every public marketing page),
  requires no account, and lets the visitor flip between accept/decline freely.
- **First paint, before hydration**: the SSR-rendered markup for a first-time visitor shows only
  the small "Analytics preferences" reopen control, not yet the full Accept/Decline panel — the
  panel appears once React hydrates and a `useEffect` confirms no consent cookie exists
  (`AnalyticsConsent.tsx`'s `hasDecided` state defaults to `true` specifically to avoid an
  SSR/hydration flash of the panel for a _returning_, already-decided visitor). In practice this
  effect runs within the same frame as hydration, but it means a raw HTTP fetch of the page
  (no JS execution) never observes the Accept/Decline buttons in the response body — only the
  reopen control's "Analytics preferences" text. `scripts/smoke-test.ts` checks for that text,
  not the buttons, for exactly this reason.

## What revocation can and cannot guarantee

Clearing `_ga*` cookies and sending `gtag("consent", "update", ...)` stops **future** collection on
this domain. It cannot delete data already transmitted to Google in a prior session, and it cannot
reach cookies scoped to a different domain. This is stated plainly rather than implied to be a
full erasure — see the privacy policy's own wording.

## Consent UI

A persistent, non-modal `role="region"` panel (`apps/web/src/components/AnalyticsConsent.tsx`),
not a `role="dialog"` — deliberately, so it never traps focus and never blocks access to the rest
of the page ("no consent wall" is a hard requirement). Two buttons of equal visual prominence
("Accept analytics" / "Decline analytics"); no "Accept all" as a dominant action, no hidden
decline link, no countdown, no repeated popups, no dark patterns. See
`docs/security/PHASE_13_ANALYTICS_PRIVACY_THREAT_REVIEW.md` for the accessibility/security review
of this component.

## Consent choice tracking (aggregate only)

`analytics_consent_granted` / `analytics_consent_declined` / `analytics_consent_changed` are
recorded as ordinary first-party `product_events` rows (see
`docs/analytics/PRODUCT_EVENT_REGISTRY.md`) — no visitor identifier, no cookie value, no IP is
ever included as a property. This is purely an aggregate count (surfaced in the Super Admin
"Measurement health" section), never a per-visitor consent history.

## No third-party consent platform

The consent system is entirely first-party (`apps/web/src/lib/consent.ts` +
`AnalyticsConsent.tsx`) — no Cookiebot, OneTrust, CookieYes, TrustArc, or other third-party
consent script was added. CrawlPact's existing first-party infrastructure was judged sufficient
for a single yes/no choice with no cross-site consent-signal requirement.

## Verification

- **Route/cookie/version logic**: `apps/web/src/lib/consent.test.ts` (9 unit tests) — the
  `isGaEligibleRoute` allowlist and the cookie encode/parse/version-staleness behaviour.
- **Structural GA boundary**: `apps/web/src/layouts/ga-boundary.test.ts` (7 tests, source
  inspection) — `AppLayout`/`AdminLayout`/`BaseLayout` never reference `GoogleAnalytics`/`gtag`,
  and `MarketingLayout`'s `shouldRenderGa` is derived from `isProduction && gaEligible &&
consentState === "granted"`, not consent alone.
- **Property-write validation**: `apps/web/tests/integration/analytics-event-validation.integration.test.ts`
  (14 tests, real D1) — PII-shaped property keys rejected before any row is written.
- **Real-browser, non-production environment**: `apps/web/tests/e2e/analytics-consent.spec.ts` (7
  Chromium tests) — proves no `googletagmanager.com` script tag and no consent banner render on
  the homepage, an authenticated `/app` page, `/admin/analytics`, or the excluded `/sign-in` route,
  in the environment `browser-smoke`'s CI job actually runs (`PUBLIC_APP_ENV=local`).
- **Disclosed limitation — interactive accept/decline/revoke journeys**: `AnalyticsConsent`'s
  banner only mounts when `MarketingLayout.astro`'s `isProduction` check is true
  (`PUBLIC_APP_ENV === "production"`). The e2e harness (`playwright.config.ts`,
  `browser-smoke` in `ci.yml`) always runs at `PUBLIC_APP_ENV=local`, so the banner cannot be
  clicked through in that harness — this is the same architectural gate that has kept the
  pre-existing `GoogleAnalytics` component itself untested end-to-end since it was first added,
  not a new gap introduced this phase. The banner's click handlers (`accept`/`decline`, cookie
  read/write, `loadGoogleAnalytics`/`denyGaIfLoaded`/`clearGaCookies`) are ordinary, non-Astro
  TypeScript functions covered by direct code review rather than a browser harness; a full
  interactive verification (click Accept, confirm the GA script tag appears; click Decline,
  confirm it does not; reload, confirm the choice persists; reopen via the "Analytics
  preferences" button, confirm the choice can be changed) should be performed manually against a
  real `PUBLIC_APP_ENV=production` deploy before or immediately after this phase's own production
  release, and is not claimed as automated end-to-end coverage.
