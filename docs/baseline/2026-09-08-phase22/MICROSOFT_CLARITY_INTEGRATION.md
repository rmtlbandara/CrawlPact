# Phase 22 Microsoft Clarity Integration (Section 112 addendum)

## What was implemented

Microsoft Clarity, gated identically to the existing Google Analytics integration:

- **Script**: `apps/web/src/components/MicrosoftClarity.astro` — Microsoft's supplied project
  snippet (project ID `yf18yfb8m9`), functionally unaltered (Prettier reformatted whitespace only;
  the logic, order of operations, and literal values are byte-for-byte the same as supplied).
- **Server-side gate**: `MarketingLayout.astro`'s `shouldRenderClarity` is deliberately assigned
  `shouldRenderGa` directly (not a parallel, independently-computed boolean) — same
  `PUBLIC_APP_ENV === "production"` check, same `isGaEligibleRoute` allowlist, same granted-consent
  cookie check. This means Clarity structurally cannot diverge from GA's route/consent/environment
  boundary by construction, not just by current configuration.
- **Client-side gate**: `AnalyticsConsent.tsx`'s existing `loadGoogleAnalytics()` client-side loader
  (fires when a _first-time_ visitor clicks "Accept" during the current page view, before any
  SSR-rendered consent cookie exists) now has a `loadMicrosoftClarity()` counterpart, called
  alongside it in both the mount-time effect and `accept()`. Found and fixed live: without this,
  Clarity would only have started on a consenting visitor's _next_ page load, not the one where
  they actually granted consent.
- **Decline path**: `clearClarityCookies()` (best-effort, mirrors the existing `clearGaCookies()`)
  clears Clarity's own documented `_clck`/`_clsk` cookies on decline.

## Why Production-only, matching GA

Preview traffic never reaches Clarity, for the same reason it never reaches GA:
`shouldRenderClarity` inherits GA's `isProduction` check. This avoids contaminating real Clarity
session data with Preview traffic, per the addendum's explicit instruction.

## Why the existing GA allowlist, not a separate one

The addendum explicitly said to prefer an existing allowlist architecture if one exists. One does
(`apps/web/src/lib/consent.ts`'s `isGaEligibleRoute`, already excluding `/app/*`, `/admin/*`,
`/pay`, `/shared/[token]`, `/audit/[auditId]`, and several legal/infra pages) — reused directly
rather than duplicated.

## CSP

Microsoft's own official CSP guidance
(`learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-csp`, fetched fresh this phase)
recommends `https://*.clarity.ms` (Clarity load-balances across lettered subdomains,
`a.clarity.ms`-`z.clarity.ms`) and `https://c.bing.com`. Added to `script-src` (script tag load,
`https://www.clarity.ms` specifically) and `connect-src` (`https://*.clarity.ms` and
`https://c.bing.com`, for the data-collection calls the loaded script makes) in
`apps/web/src/lib/security-headers.ts`, with `apps/web/public/_headers` updated to match
byte-for-byte (that file's own test, `security-headers.test.ts`, asserts the two never drift).
No `default-src` wildcard was used — this site's CSP is per-directive, and Microsoft's own docs
name `default-src` as one _option_, not the only one; the per-directive minimum was chosen to stay
consistent with how every other third-party origin on this site's CSP is scoped.

## Privacy disclosure

`docs/privacy` (`apps/web/src/pages/privacy.astro`) updated to name Microsoft Clarity everywhere
Google Analytics was previously named alone: "how information is collected," "cookies," "analytics
and your choice," and "sharing and processors." A new `TRUST_CONFIG.behavioralAnalyticsProvider`
field ("Microsoft Clarity") was added rather than overloading the existing `analyticsProvider`
string, since several surrounding sentences have singular/plural grammar that a blind
find-and-replace would have broken. `policyEffectiveDate` bumped to 2026-09-08 — a real,
substantive disclosure change, not a routine touch. The consent banner copy
(`AnalyticsConsent.tsx`) was updated the same way.

## Tests added (all passing — see the completion report's quality-gate section)

- `apps/web/tests/e2e/analytics-consent.spec.ts` — every existing GA never-loads-outside-production
  / never-on-authenticated-pages test now also asserts no `clarity.ms` script tag.
- `apps/web/src/layouts/ga-boundary.test.ts` — new `describe` blocks: Clarity never reaches
  AppLayout/AdminLayout/BaseLayout output; `MarketingLayout.astro` gates Clarity behind
  `shouldRenderClarity`, and that flag is asserted (via source inspection of the actual expression)
  to equal `shouldRenderGa` verbatim, not a separately-computed and potentially weaker check;
  `/status` and its Atom feed never reference `clarity.ms`.
- `scripts/smoke-test.ts` — production-only, post-deploy check that a cookie-less first visit to
  the home page never includes a `clarity.ms` script tag, mirroring the existing GA check.

## What was deliberately not implemented

- Clarity's own "Consent Mode" API (`clarity('consent', ...)`) — that mechanism assumes the script
  loads unconditionally and gates only cookie-writing behavior via a signal sent after the fact.
  CrawlPact's existing pattern (never load the script at all before consent) is strictly stronger
  than Consent Mode, so implementing Consent Mode on top would add complexity without adding any
  privacy guarantee this integration doesn't already have.
- No custom Clarity events — no concrete, documented UX/SEO measurement need was identified this
  phase that would justify one, per the addendum's own instruction.
- No change to GA4 or the first-party `product_events` architecture — Clarity is additional
  behavioural evidence, not a replacement for either, per the addendum.

## Explicitly not an SEO mechanism

Clarity does not affect Google ranking. Nothing in this package or the content changed this phase
claims otherwise, per the addendum's own closing instruction.
