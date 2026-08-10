# Phase 13 Analytics and Consent Baseline

**Level 4 document (point-in-time evidence).** What was actually found, by direct code
inspection, before Phase 13 made any change. See
`docs/reports/PHASE_13_ANALYTICS_CONSENT_PRODUCT_MEASUREMENT_COMPLETION_REPORT.md` for what
changed.

## `trackEvent()` and `product_events` (before)

`apps/web/src/lib/analytics.ts` already existed with 103 event names across Phases 4–10, written
from 46 real server-side call sites, no third-party vendor, `properties` a shallow
`Record<string, string|number|boolean>` with **no runtime key-pattern validation** (only the
client-facing `/api/analytics/track` endpoint's Zod schema capped string length and rejected
unknown event names — every direct server-side `trackEvent()` call had no enforcement at all).
`anonymousId` existed as a typed, DB-backed field but was **never populated by any call site** —
a dead capability, not a working anonymous-tracking mechanism.

## Google Analytics (before)

`apps/web/src/components/GoogleAnalytics.astro` rendered unconditionally
(`{isProduction && <GoogleAnalytics />}`) in `MarketingLayout.astro` — gated on
`PUBLIC_APP_ENV === "production"` only, with **zero consent check of any kind**. Confirmed via
direct grep that `AppLayout.astro`/`AdminLayout.astro` never import it (matching the existing
disclosed SRS §6.2 deviation's own claim). CSP (`security-headers.ts`) already allowlisted
`googletagmanager.com`/`google-analytics.com` in `script-src`/`connect-src`.

## Cookies and storage (before)

Exactly one cookie existed anywhere in the app: the `crawlpact_session` authentication cookie
(`HttpOnly`, `Secure`, `SameSite=Lax`). Zero `localStorage`/`sessionStorage` usage anywhere in
`apps/web/src`.

## Privacy policy (before)

`apps/web/src/pages/privacy.astro` stated, verbatim: _"CrawlPact does not currently offer a
cookie-consent or preference-management control for these analytics cookies — this is a known,
disclosed gap, not an unstated omission."_ Section 7 also pointed visitors at "the project's public
documentation" for the underlying decision record — documentation that only existed inside this
private repository (a real finding, fixed this phase — see the repository-exposure docs).

## Relevant risk register entries (before, verbatim IDs)

- **RISK-004** — Cloudflare Web Analytics beacon / AI Crawl Control undecided, targeted at Phase 13.
- **RISK-006** — `product_events` (and `security_events`, `notifications`) has no purge job; Phase
  11 recommended 18 months for `product_events` specifically but did not implement it, pending
  approval.
- **RISK-020** — No automated test asserts GA never loads outside `MarketingLayout`, targeted at
  Phase 13.
- **RISK-021** (P1) — No cookie-consent mechanism while GA sets tracking cookies, targeted at
  Phase 13.

## Super Admin analytics (before)

No `/admin/analytics` route existed. `productEvents` was imported nowhere except its own writer —
nothing in the codebase had ever read the table. Fully greenfield for this phase.

## Repository privacy (before)

All 11 workspace `package.json` files already had `"private": true`, zero `publishConfig`
anywhere, root `license: "UNLICENSED"`. `README.md`/`CONTRIBUTING.md` already correctly framed the
repo as private/solo-founder — no public-contribution language found. GitHub repo confirmed
`private`, 0 forks, 0 releases, Pages disabled (404). No production source maps generated. No
hardcoded secrets found in the built client bundle. One genuine finding: `privacy.astro`'s
"public documentation" reference (above). One genuine finding: `apps/web/src/lib/json-response.ts`
(and two duplicate call sites) passed the raw exception `.message` to API clients unconditionally,
including in production.
