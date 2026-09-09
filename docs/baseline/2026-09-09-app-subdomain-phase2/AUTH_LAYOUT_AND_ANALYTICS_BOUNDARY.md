# AuthLayout and Analytics Boundary — Phase 2

Date: 2026-09-09. Implements the Phase 1 finding: `sign-in.astro` inherited `MarketingLayout`'s
header/footer/consent-banner apparatus even though GA/Clarity scripts were already excluded from
that route.

## `AuthLayout.astro` (new)

`apps/web/src/layouts/AuthLayout.astro`, modeled on `AppLayout.astro`/`AdminLayout.astro`'s
pattern (wraps `BaseLayout` directly, never imports any marketing analytics component). Provides:

- CrawlPact wordmark linking to the public homepage, minimal header.
- Privacy/Terms/Security links in a minimal footer.
- `noindex={true}` unconditionally.
- No Google Analytics, Microsoft Clarity, or the analytics-consent banner island — structurally
  absent (no import exists), not merely gated off at runtime.
- All navigation links resolve via `lib/origin.ts`'s `toPublicUrl()` — absolute URLs to the public
  origin — rather than bare relative paths, since this page is reachable from either trusted
  CrawlPact origin during the Phase 2/3 migration-compatibility window and "Home"/"Privacy"/
  "Terms"/"Security" are always public-surface pages regardless of which host is currently serving
  the sign-in form itself.
- Preserves Google Identity Services support with no change: CSP entries for
  `accounts.google.com/gsi/*` are applied globally by `middleware.ts` for every SSR response
  (including this one), so no additional CSP/COOP work was needed here specifically.

`sign-in.astro` now imports `AuthLayout` instead of `MarketingLayout`; no other change to that
page's logic (continuation/plan handling, `PasskeyAuth` component, redirect construction all
unchanged).

## Analytics boundary test coverage extended

`apps/web/src/layouts/ga-boundary.test.ts` gained:

- `AuthLayout.astro` never references GoogleAnalytics/gtag/googletagmanager.com (mirrors the
  existing `AppLayout`/`AdminLayout` assertions).
- `AuthLayout.astro` never references MicrosoftClarity/clarity.ms.
- `AuthLayout.astro` never imports the analytics-consent component.
- `AuthLayout.astro` always sets `noindex={true}`.
- `AuthLayout.astro`'s public navigation links use `toPublicUrl(...)`, not a bare relative path.
- `sign-in.astro` imports `AuthLayout` and never references `MarketingLayout`.

All new assertions pass; the pre-existing `MarketingLayout`/`AppLayout`/`AdminLayout`/`BaseLayout`
assertions in the same file are unmodified and continue to pass.

## First-party product telemetry

Unaffected. `apps/web/src/lib/analytics-client.ts`'s `track()` calls (e.g. `account_started` fired
from `PasskeyAuth.tsx`) are same-origin `POST /api/analytics/track` calls — classified
`SHARED_SAME_ORIGIN_SURFACE` in `ORIGIN_AND_ROUTE_OWNERSHIP_MATRIX.md` and untouched by this
phase's CSRF redesign beyond the general self-referential check every route now benefits from.
