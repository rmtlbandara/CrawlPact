# Phase 13 — Analytics, Consent, Product Measurement and Private-Repository Exposure Governance — Completion Report

**Date**: 2026-08-10 · **Branch**: `phase-13-analytics-consent-private-repo`

## Summary

This phase closed two real, previously-open gaps: Google Analytics ran on public marketing pages
with zero consent gating (RISK-021), and there was no automated regression test proving GA could
never reach authenticated/admin output (RISK-020). It also built the first-party product-
measurement system the SRS's §28.13 has always named but that never actually existed, and
established a repository-confidentiality governance layer (classification, surface inventories,
confidentiality policy, exposure audit, two new CI-gated validators) in response to the standing
instruction to always treat this repository as private. No pricing, Paddle product/price, crawler
classification, audit semantics, monitoring cadence, or notification-channel behaviour was
touched. No third-party analytics vendor or consent-management platform was added — the consent
system and the product-measurement system are both entirely first-party. No public country
information was reintroduced.

## What shipped

### Real consent gating for Google Analytics (RISK-021)

- `apps/web/src/lib/consent.ts` — the single source of truth for the consent cookie
  name/format/version and the GA route allowlist (`isGaEligibleRoute`), shared by SSR
  (`MarketingLayout.astro`, `GoogleAnalytics.astro`) and the client-side consent island.
- `apps/web/src/components/AnalyticsConsent.tsx` — a persistent, non-modal (`role="region"`, not
  `role="dialog"`) consent banner. No consent wall: declining has zero effect on using CrawlPact.
- `MarketingLayout.astro`'s `shouldRenderGa = isProduction && gaEligible && consentState ===
"granted"` — GA's `<script>` tag does not exist in the DOM at all pre-consent (a real technical
  block, not cookie-only gating). `page_location` is explicitly overridden to
  `origin + pathname`, never raw `location.href`. Consent-mode-style signals are sent
  (`analytics_storage: "granted"`, `ad_*: "denied"` always — CrawlPact does no ad personalization).
- `GA_ALLOWED_EXACT`/`GA_ALLOWED_PREFIXES` — an explicit allowlist, not "every MarketingLayout
  page": `/pay`, `/sign-in`, `/shared/[token]`, `/audit/[auditId]` are excluded even though they
  render inside `MarketingLayout`.
- 3 new `product_events` names (`analytics_consent_granted`/`_declined`/`_changed`) record an
  aggregate consent-choice counter only — no cookie value, IP, or visitor identifier.
- `docs/analytics/CONSENT_AND_ANALYTICS_PREFERENCE_MODEL.md`,
  `docs/analytics/GOOGLE_ANALYTICS_SCOPE_POLICY.md`,
  `docs/analytics/PHASE_13_ANALYTICS_CONSENT_BASELINE.md`.

### GA-boundary regression test (RISK-020)

- `apps/web/src/layouts/ga-boundary.test.ts` (7 tests) — source-inspection assertions that
  `AppLayout.astro`, `AdminLayout.astro`, and `BaseLayout.astro` never reference
  `GoogleAnalytics`/`gtag`/`googletagmanager.com`, and that `MarketingLayout.astro`'s
  `shouldRenderGa` is structurally derived from all three conditions, not consent alone.
- `apps/web/src/lib/consent.test.ts` (9 tests) — the route allowlist and cookie
  encode/parse/version-staleness logic.
- `apps/web/tests/e2e/analytics-consent.spec.ts` (7 Chromium tests) — real-browser proof, in the
  actual environment `browser-smoke`'s CI job runs (`PUBLIC_APP_ENV=local`), that no
  `googletagmanager.com` script tag and no consent banner render on the homepage, `/app`,
  `/admin/analytics`, or the excluded `/sign-in` route.

### First-party product measurement (SRS §28.13)

- `apps/web/src/lib/admin/product-analytics.ts` (`getProductAnalyticsSnapshot`) — North Star
  (active monitored domains with a valid baseline), acquisition, audit funnel, activation,
  engagement, WAU/MAU, a disclosed **simplified** retention proxy (not full cohort day-N —
  judged out of scope given current real volume; see
  `docs/analytics/CRAWLPACT_PRODUCT_MEASUREMENT_STRATEGY.md`), conversion, revenue (estimated
  MRR, clearly labelled as such), and agency-adoption metrics. Every ratio is rendered as
  `N / D — P%`, "Insufficient historical data" when the denominator is 0 — never a bare
  percentage from a tiny sample.
- `GET /api/admin/analytics` (`requireAdminSession`-gated) + `/admin/analytics`
  (`ProductAnalyticsDashboard.tsx`, 9 sections).
- `apps/web/tests/integration/product-analytics.integration.test.ts` (2 tests, real seeded-D1
  aggregation numbers verified, not fabricated).
- `docs/analytics/PRODUCT_EVENT_REGISTRY.md`, `docs/analytics/PRODUCT_METRIC_DICTIONARY.md`,
  `docs/analytics/ANALYTICS_DATA_FLOW.md`, `docs/analytics/CRAWLPACT_PRODUCT_MEASUREMENT_STRATEGY.md`.

### PII-shaped property guard and validation tests

- `apps/web/src/lib/analytics.ts`'s `PROHIBITED_PROPERTY_KEY_PATTERN` — any property key matching
  `email`/`domain`/`url`/`token`/`ip`/`useragent`/`password`/`secret`/`ssn`/`credit card` throws
  `ProhibitedAnalyticsPropertyError`, server-side, regardless of caller. Verified against all 46
  pre-existing `trackEvent()` call sites before shipping (zero collisions).
- `apps/web/tests/integration/analytics-event-validation.integration.test.ts` (14 tests, real D1)
  — 11 synthetic PII-shaped-key rejection cases, valid-event writes, and confirmation that a
  rejected event never persists a row.

### `product_events` retention (RISK-006, partial)

- `PRODUCT_EVENT_RETENTION_DAYS = 548` (18 months), `purgeExpiredProductEvents()`
  (`apps/web/src/lib/data-retention.ts`), registered as a new `expired_product_events` category in
  the existing daily retention cron — no new job, no new schedule.
- `docs/analytics/PHASE_13_PRODUCT_EVENT_RETENTION_DECISION.md`. 2 new tests appended to
  `data-retention.integration.test.ts` (11/11 pass in that file).
- `security_events`/`notifications` remain unbounded — RISK-006 stays open for those two, not
  extended approval this phase.

### Error-response leakage fix

- `apps/web/src/lib/json-response.ts`'s `jsonErrorResponse` (used by 100+ API routes) and two
  duplicate inline call sites (`api/audit/index.ts`, `api/audit/[auditId]/continuation.ts`)
  previously included the raw `Error.message` in every unhandled-exception response, in every
  environment including production. Now gated behind `PUBLIC_APP_ENV !== "production"`.

### Private-repository governance

- `docs/governance/PUBLIC_PRIVATE_INFORMATION_CLASSIFICATION.md`,
  `PUBLIC_SURFACE_INVENTORY.md`, `PRIVATE_SURFACE_INVENTORY.md`,
  `REPOSITORY_CONFIDENTIALITY_POLICY.md`, `PHASE_13_REPOSITORY_EXPOSURE_AUDIT.md` (including live
  web-search verification — no public fork, mirror, GitHub Pages, or third-party cached copy found
  this pass; absence of evidence explicitly not claimed as proof of absence).
- `docs/security/PRODUCTION_SOURCE_MAP_POLICY.md`,
  `PHASE_13_REPOSITORY_SOURCE_EXPOSURE_THREAT_REVIEW.md`,
  `PHASE_13_ANALYTICS_PRIVACY_THREAT_REVIEW.md`.
- `scripts/repo-privacy-validate.mjs` — 6-part validator (package-publish config, customer-facing
  repo-claim language, source maps, internal docs under public assets, `PUBLIC_*` secret exposure).
- `scripts/analytics-validate.mjs` — 6-part validator (GA scope, consent wiring, privacy-policy
  sync, event-registry sync).
- Both wired into `pnpm quality:gate`, `.github/workflows/ci.yml`, and
  `scripts/verify-push.sh`, with `repo-privacy:validate` re-run a second time after `build` (a
  build could theoretically emit something the pre-build scan wouldn't see).
- `apps/web/src/pages/privacy.astro` — a misleading "see the project's public documentation"
  reference (pointing at content that only exists inside this private repository) reworded.
- `README.md` — private-repository notice added near the top.

## Real GitHub-visibility evidence (read-only checks only — see below)

- `gh api repos/rmtlbandara/CrawlPact` → `private: true`.
- `gh api .../forks` → `[]`. `gh api .../releases` → `[]`. `gh api .../pages` → `404`.
- All 11 workspace `package.json` files: `"private": true`, zero `publishConfig`.
- `apps/web/dist/client/**/*.js` (real build output): zero `.map` files, zero
  `sourceMappingURL` references, zero matches for `PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET`/
  `CLOUDFLARE_API_TOKEN`/`SESSION_SIGNING_SECRET`/`ABUSE_MONITORING_SECRET`.
- Live web search for the repository name and "CrawlPact source code github repository" returned
  no relevant result this pass.
- **No write/PUT call was made to any GitHub repository-settings endpoint this phase** — every
  visibility check was a `GET`, honouring the standing instruction and avoiding a repeat of the
  Phase 12 incident where a mistaken "dry check" applied a live branch-protection change.

## What was deliberately NOT done this phase

- **Full per-event typed-property schema** for all 106 events (§24) — a single event-independent
  runtime PII-shaped-key guard was implemented instead; a full typed-contract migration across
  46+ call sites was judged a separately-scoped effort. Disclosed in
  `docs/analytics/PRODUCT_EVENT_REGISTRY.md`, not silently substituted.
- **Full cohort day-N retention analysis** (§36) — a simplified same-period-activity proxy was
  implemented instead, clearly labelled in the dashboard UI and in
  `docs/analytics/CRAWLPACT_PRODUCT_MEASUREMENT_STRATEGY.md`. CrawlPact's current real account
  volume would make true cohort analysis statistically meaningless regardless.
- **Live GA4 property-level admin settings audit** (retention window, Google Signals, ads
  linking, data-sharing options) — no live browser session against the GA4 admin UI is available
  in this environment. `docs/analytics/PHASE_13_GA_PROPERTY_CONFIGURATION_AUDIT.md` separates what
  was verified from code from what could not be verified, with a recommended manual posture.
- **Cloudflare Web Analytics / AI Crawl Control decision (RISK-004)** — closed with a deliberate
  decision to leave both unchanged (Web Analytics stays disabled; AI Crawl Control's `robots.txt`
  injection stays as-is), not a silent drop. See `docs/risks/RISK_ARCHIVE.md` ARC-030.
- **Interactive accept/decline/revoke consent-banner e2e journeys** — `AnalyticsConsent` only
  mounts when `isProduction` is true, and the e2e harness always runs at `PUBLIC_APP_ENV=local` —
  the same architectural gate that has kept `GoogleAnalytics` itself untested end-to-end since it
  was first added, not a new gap this phase introduced. Covered instead by unit tests on the
  underlying logic, a real-browser proof of correct _absence_ outside production, and new
  production-only checks in `scripts/smoke-test.ts`. Full disclosure:
  `docs/analytics/CONSENT_AND_ANALYTICS_PREFERENCE_MODEL.md` "Verification". A manual interactive
  check against the real production deploy is recommended before/after this phase's release.
- **security_events / notifications retention** — RISK-006 stays open for these two; only
  `product_events` had explicit approval to implement this phase.
- No third-party analytics vendor, no third-party consent-management platform, no pricing/Paddle/
  crawler-classification/monitoring/notification-channel change, no public country information.

## Test evidence

- `pnpm quality:gate`: **exit 0** — format check, lint, typecheck (0 errors), unit (**392/392**,
  39 files), integration (**277/277**, 39 files), security (**41/41**, 8 files), `db:validate`
  (48 tables, unchanged from Phase 12), `docs:validate`, `brand:validate`, `trust:validate`,
  `status:validate`, `content:validate`, `repo-privacy:validate` (×2, pre- and post-build),
  `analytics:validate`, `pnpm audit --audit-level=critical` (0 critical / 8 high / 4 moderate —
  unchanged from Phase 12, all confirmed dev-only tooling), and `build` — all green.
- `pnpm test:e2e:chromium`: **137/138 passed**, 1 flaky
  (`checkout-continuity.spec.ts`'s WebAuthn-form-hydration timing test — the same known
  CI-runner-timing pattern noted in Phase 12's report, unrelated to this phase's changes).
- `pnpm test:a11y:chromium`: **109/109 passed**.
- New test files this phase: `apps/web/src/lib/consent.test.ts` (9), `apps/web/src/layouts/ga-boundary.test.ts`
  (7), `apps/web/tests/integration/analytics-event-validation.integration.test.ts` (14),
  `apps/web/tests/integration/product-analytics.integration.test.ts` (2),
  `apps/web/tests/e2e/analytics-consent.spec.ts` (7) — 39 new tests total.

## Files created/modified

**New**: `apps/web/src/lib/consent.ts`, `apps/web/src/lib/consent.test.ts`,
`apps/web/src/layouts/ga-boundary.test.ts`, `apps/web/src/components/AnalyticsConsent.tsx`,
`apps/web/src/lib/admin/product-analytics.ts`, `apps/web/src/components/admin/ProductAnalyticsDashboard.tsx`,
`apps/web/src/pages/api/admin/analytics.ts`, `apps/web/src/pages/admin/analytics/index.astro`,
`apps/web/tests/integration/product-analytics.integration.test.ts`,
`apps/web/tests/integration/analytics-event-validation.integration.test.ts`,
`apps/web/tests/e2e/analytics-consent.spec.ts`, `scripts/repo-privacy-validate.mjs`,
`scripts/analytics-validate.mjs`, 18 new docs under `docs/analytics/`, `docs/governance/`,
`docs/security/` (see `docs/governance/DOCUMENTATION_INVENTORY.md` for the full list), this report.

**Modified**: `apps/web/src/components/GoogleAnalytics.astro`, `apps/web/src/layouts/MarketingLayout.astro`,
`apps/web/src/lib/analytics.ts`, `apps/web/src/lib/data-retention.ts`,
`apps/web/src/lib/json-response.ts`, `apps/web/src/pages/api/audit/index.ts`,
`apps/web/src/pages/api/audit/[auditId]/continuation.ts`, `apps/web/src/pages/privacy.astro`,
`apps/web/tests/integration/data-retention.integration.test.ts`, `package.json`,
`.github/workflows/ci.yml`, `scripts/verify-push.sh`, `scripts/smoke-test.ts`, `README.md`,
`CHANGELOG.md`, `docs/status/REQUIREMENTS_TRACEABILITY.md`, `docs/risks/ACTIVE_RISKS.md`,
`docs/risks/RISK_ARCHIVE.md`, `docs/governance/DOCUMENTATION_INVENTORY.md`.

## Risk register status

| Risk     | Status before | Status after                    | Note                                                      |
| -------- | ------------- | ------------------------------- | --------------------------------------------------------- |
| RISK-004 | open          | **closed** (ARC-030)            | Deliberate decision: leave both unchanged, documented     |
| RISK-006 | monitoring    | monitoring (partially resolved) | `product_events` now purged (18mo); other two remain open |
| RISK-020 | open          | **closed** (ARC-032)            | GA-boundary regression test now exists, 16 tests          |
| RISK-021 | open          | **closed** (ARC-031)            | Real consent mechanism now gates GA                       |

No new numbered risk was found this phase. `docs/risks/RISK_ARCHIVE.md` now ends at ARC-032.

## Confirmations

- Repository remains **private** (re-confirmed, read-only, no write call made).
- Public SEO/marketing content remains public and unchanged in substance (only the misleading
  `privacy.astro` documentation-reference was reworded; no page was de-indexed or hidden).
- Pricing and Paddle products/prices: unchanged.
- Crawler classification/registry governance and audit semantics: unchanged.
- Monitoring cadence and notification channels: unchanged.
- No public country/jurisdiction information was added (RISK-029 remains as previously recorded).
- No third-party analytics vendor or consent-management platform was introduced.

## Next steps

1. Push branch, open PR, merge (pending explicit confirmation).
2. Deploy to production (pending explicit confirmation), then independently verify via
   `scripts/smoke-test.ts production https://crawlpact.com` — including the two new Phase 13
   checks (no GA script on a cookie-less first visit; consent-banner markup present).
3. Perform the manual interactive consent-banner verification (accept/decline/revoke, reload
   persistence) against the live production deploy, since the automated e2e harness cannot reach
   `PUBLIC_APP_ENV=production`.
4. Record the deployment (commit SHA, Worker version, migration state — none this phase, no new
   migration was added) via a follow-up `CURRENT_STATE.md`/`CHANGELOG.md` update, matching the
   established two-stage pattern.
