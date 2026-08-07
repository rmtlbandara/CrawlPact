# Changelog

This file tracks engineering-level changes to the CrawlPact repository. For the customer-facing
changelog, see the `/changelog` page on the public website.

Format: dated entries, newest first, inspired by [Keep a Changelog](https://keepachangelog.com/),
adapted for this repository's pass/phase-based workflow. Most entries already carry `### Added` /
`### Changed` / `### Fixed` / `### Security` / `### Removed` subsections where more than one kind
of change occurred in the same pass — kept as originally written rather than retrofitted, per
Phase 1's rule against fabricating or restructuring verifiable history. Add new entries under
**Unreleased** below and give them a dated section heading once actually deployed to production —
this distinguishes a code merge from a production deployment, which are not the same event (see
the "Production deployment" entries below for the established pattern).

## Unreleased

Nothing pending — see "Production deployment (2026-08-07) — Phase 9: Agency Workspace and
Portfolio Workflows" below for the most recent release.

## Production deployment (2026-08-07) — Phase 9: Agency Workspace and Portfolio Workflows

PR #93 (squash-merged as `3ee3b2f`) deployed to production via `deploy-production.yml`, run
against commit `3ee3b2f0bd25ff050b7f592e0b057a1b2db7c144`. One new additive D1 migration applied
(`0029_agency_workspace_portfolio.sql` — `domain_groups.description` column,
`agency_brand_profiles`/`portfolio_import_jobs`/`portfolio_import_rows`/`bulk_action_jobs` tables,
5 new indexes; 29/29 migrations applied, 47 tables total). Deployed Worker version:
`7ce60f6d-5ed9-4cf2-b9ff-a2b5ac31e44c`. Full detail:
`docs/reports/PHASE_09_AGENCY_WORKSPACE_PORTFOLIO_COMPLETION_REPORT.md`.

Adds an authenticated agency/portfolio workspace (`/app/workspace`), an explainable portfolio
summary and deterministic attention queue, an account-wide cursor-paginated portfolio change feed,
safe non-empty domain-group deletion (domains move to Ungrouped, history preserved), a
server-side-paginated portfolio table, a genuine CSV file batch-import workflow (hand-written RFC
4180 parser, preview/confirm, idempotent), an extended CSV export (group/selection scope, more
columns), bounded bulk actions (group assignment, monitoring state), a persistent Agency-branding
profile, and wiring for the previously-unused `saved_filters`/`table_preferences` schema into real
saved views. Closes RISK-010 (R2 agency-logo orphan cleanup) via a new category in the existing
daily retention cron. Team roles, a client portal, bulk rescan, a multi-domain portfolio-report
product, and cross-domain comparison were evaluated against the SRS and explicitly not
implemented — see the six `docs/product/PHASE_09_*_DECISION.md` documents.

Found and fixed two real defects during this phase's own testing: a D1 bound-parameter limit
(~100) that would have broken any CSV import over ~14 rows in production (fixed by chunking the
row-insert statement); and a pre-existing accessibility defect (an unlabelled group-rename input
in `GroupsManager.tsx`, present before this phase) caught by a new a11y scan of a populated groups
list.

**Independent post-deploy verification**: direct production D1 queries confirm all four new
tables (`agency_brand_profiles`, `portfolio_import_jobs`, `portfolio_import_rows`,
`bulk_action_jobs`) and the `domain_groups.description` column exist, and
`wrangler d1 migrations list --remote` reports "No migrations to apply!" (29/29 applied). Direct
`curl` checks confirm every new route (`/app/workspace`, `/app/workspace/domains`,
`/app/workspace/import`, `/app/agency-branding`, `/api/workspace/summary`,
`/api/workspace/import/template.csv`) correctly requires authentication (302 redirect for pages,
401 `UNAUTHENTICATED` for APIs) and carries `Cache-Control: private, no-store` and
`X-Robots-Tag: noindex, nofollow, noarchive`. The public homepage (200) and `/pricing` (200) were
also checked, confirming no regression to unrelated public routes.

## Production deployment (2026-08-06) — Phase 8: Saved-Domain Experience and Change Timeline

PR #91 (squash-merged as `8d7d291`; follow-up CI-only bug fix included in the same PR before
merge) deployed to production via `deploy-production.yml`, run against commit
`8d7d291528d201011ef69e4f857264a3d67fec93`. Three new additive D1 migrations applied
(`0026_domain_change_events`, `0027_findings_fingerprint_column`,
`0028_domains_scan_lock`). Deployed Worker version: `629c546c-ba30-4147-af6f-b750e5c051b2`. Full
detail: `docs/reports/PHASE_08_SAVED_DOMAIN_CHANGE_TIMELINE_COMPLETION_REPORT.md`.

**Independent post-deploy verification**: direct production D1 queries confirm all three
migrations applied (`domain_change_events` table exists; `findings.fingerprint` and
`domains.scan_lock_until` columns exist). Direct `curl` checks confirm `/app/domains` and
`/app/domains/:id` correctly redirect an unauthenticated request to `/sign-in` (302), and
`GET /api/domains/:id/timeline` correctly returns `401 UNAUTHENTICATED` for an unauthenticated
request. The public homepage (200) and the public status page (still "Operational", confirming
the prior status/changelog trust correction was not regressed by this deploy) were also checked.

### Added

- A deterministic, versioned change-attribution model
  (`website_policy | registry_driven | mixed | operational | uncertain | baseline`).
- A materialised, paginated, idempotent policy-change timeline (`domain_change_events`).
- A real before/after scan-comparison view with escaped evidence and finding-lifecycle
  classification.
- A real duplicate-simultaneous-scan lock (`domains.scan_lock_until`) and a new
  `SCAN_ALREADY_RUNNING` error code.
- A redesigned saved-domain list and domain-detail page.

### Fixed

- `computePolicySummary()`'s `monitoring` field was hardcoded to `"Not enabled"` regardless of the
  domain's real monitoring state.
- The saved-domain scan-history list rendered raw status-enum text instead of a human label
  (closes messaging-audit item C3).
- `scan_diffs`-equivalent data had no customer-facing UI at all before this phase (closes
  messaging-audit item C5).

#### Added

- A deterministic, versioned change-attribution model
  (`website_policy | registry_driven | mixed | operational | uncertain | baseline`), built on
  `scan_resources.resourceHash` (populated by Phase 11, now actually used).
- A materialised, paginated, idempotent policy-change timeline (`domain_change_events`, migration
  `0026`), generated on every scheduled sweep, manual rescan, and the Phase 5 conversion flow's
  first scan.
- A real before/after scan-comparison view (`/app/domains/:id/compare/:prev/:curr`) with escaped
  evidence and finding-lifecycle classification (appeared/persisting/changed/resolved).
- `findings.fingerprint` as a first-class, indexed column (migration `0027`), backfilled from
  existing rows.
- A real duplicate-simultaneous-scan lock (`domains.scan_lock_until`, migration `0028`) — a manual
  rescan and a concurrent request (or the scheduled sweep) can no longer both run against the same
  domain at once; a new `SCAN_ALREADY_RUNNING` error code.
- A redesigned saved-domain list (plan-limit indicator, monitoring status chip, recent-change
  column, search, sorting) and domain-detail page (current-policy summary, what-changed, real
  monitoring status including `nextScanAt` for the first time, the new timeline, reused
  full-report rendering, paginated/filterable scan history, retention messaging).

#### Fixed

- `computePolicySummary()`'s `monitoring` field was hardcoded to `"Not enabled"` regardless of the
  domain's real monitoring state.
- The saved-domain scan-history list rendered raw status-enum text (`"completed_with_warnings"`)
  instead of a human label — `STATUS_LABEL`/`STATUS_TONE` extracted into a shared module and
  reused by both the report view and the new scan-history list (closes messaging-audit item C3).
- `scan_diffs`/`domain_change_events`-equivalent data had no customer-facing UI at all before this
  phase — `scan_diffs` was write-only (closes messaging-audit item C5).

## Production deployment (2026-08-06) — Public Status and Changelog Trust Correction

PR #89 (squash-merged as `885afb4`) deployed to production via `deploy-production.yml`, run
against commit `885afb4ff53be6469b3dc5b1a5b9941c1b242b6f`. No new D1 migration (Worker/asset-only
release). Full detail: `docs/reports/PUBLIC_STATUS_AND_CHANGELOG_TRUST_CORRECTION_REPORT.md`.

This deploy fixed a real, live production bug: `/status` had been showing "Degraded performance"
for the overall status and "Billing and checkout" — confirmed via direct production checks
**before** this deploy, and independently confirmed **fixed** via the same checks immediately
after: `https://crawlpact.com/status` now shows "Operational" for both the overall status (with
the new summary sentence "All public CrawlPact services are operating normally.") and "Billing and
checkout". The dead `docs/status/IMPLEMENTATION_STATUS.md` link is gone from the page footer.
`https://crawlpact.com/changelog` now renders the new production-appropriate introduction and the
corrected "(Part 3)" entry title (previously "(Part 3, in progress)"). Deployed Worker version:
`da3ee995-b18b-4b14-b169-735b2a1859b8`.

### Fixed

- The public status page's "Billing and checkout" component (and the public overall status) could
  show "Degraded performance" based on a stale, unbounded (no time window) count of historical
  webhook-processing failures with zero real recent user impact — root-caused and fixed with a
  real 1-hour time window plus a new `publicImpact` gate so an internal-only concern can never
  again automatically escalate the public page.
- Removed a dead public link to the archived `IMPLEMENTATION_STATUS.md` doc.

### Changed

- Removed the trust-reducing "no reliable uptime measurement" sentence from `/status`, without a
  replacement negative explanation or a fabricated percentage.
- `/status` now shows a plain-language overall-status summary sentence.
- `/admin/health` now shows the public status alongside internal diagnostics, clearly labelled.
- `/changelog`'s introduction is now production-appropriate; corrected one stale entry title.

### Added

- `pnpm status:validate`, wired into CI.

#### Fixed

- The public `/status` page's "Billing and checkout" component (and, consequently, the public
  overall status) could be shown as "Degraded performance" based on a stale, unbounded (no time
  window) count of historical webhook-processing failures, with zero real recent user impact —
  confirmed live in production before this fix. `getComponentHealth` now uses a real 1-hour window
  for that check, and a new `publicImpact` field on every internal health signal means an
  internal-only concern (a background job, a resolved historical batch of failures) can never
  again automatically escalate the public page on its own.
- The public status page linked `docs/status/IMPLEMENTATION_STATUS.md`, a path that no longer
  exists (the file was correctly archived to `docs/archive/implementation-history/` back in Phase
  1. — a dead link exposing an internal-history reference publicly. Removed.

#### Changed

- Removed the "CrawlPact does not yet have reliable historical uptime measurement..." sentence
  from `/status` — a trust-reducing negative admission, not replaced with another one; no uptime
  percentage was invented.
- `/status` now shows a plain-language summary sentence for the current overall status (e.g. "All
  public CrawlPact services are operating normally."), not just the raw status label.
- `/admin/health` now shows the public status alongside internal diagnostics, clearly labelled
  ("Public:" / "Internal:"), plus public-impact flags, an internal-warning count, and active
  public incident count — previously internal-only.
- `/changelog`'s introduction now leads with a production-appropriate framing sentence; one
  changelog entry's stale "(Part 3, in progress)" title (Part 3 has long been complete) corrected
  to "(Part 3)".

#### Added

- `pnpm status:validate` — a new dedicated validator for status/changelog trust regressions
  (the removed sentence and its close variants, a fabricated uptime percentage, the archived doc
  link, internal-only fields leaking into public source), wired into CI alongside
  `trust:validate`/`docs:validate`/`brand:validate`.

Nothing deployed yet — see "Production deployment" entries below for what's actually live.

## Production deployment (2026-08-05) — Phase 11: Database, Storage, Retention and Performance Hardening

PR #86 (squash-merged as `36166a4`) plus a same-day follow-up test-timeout fix, PR #87
(squash-merged as `fc3ef36`), deployed to production via `deploy-production.yml`, run against
commit `fc3ef36aaa437b352b7a1568f26103e7f703de62`. Four new D1 migrations applied (`0022`–`0025`).
The in-workflow quality-gate re-run, migration apply, deploy, binding verification, and smoke test
all passed; independently re-verified afterward directly against the live site:

- `/`, `/status`, `/pricing`, `/changelog`, `/robots.txt`, `/sitemap.xml`, `/audit`,
  `/crawlers/amazonbot`, `/platforms/cloudflare` all return `HTTP 200` (redirects to their
  trailing-slash form for prerendered directory routes, as expected).
- The new public-cache opt-ins are live and correct: `/for/agencies`, `/scanner`, and `/changelog`
  return `Cache-Control: public, max-age=300`; `/pricing` (deliberately excluded — session-
  dependent rendering) and `/app/domains`/`/api/domains` (private, unauthenticated → 401) all
  return `Cache-Control: private, no-store` — the deny-by-default middleware default confirmed
  live on both HTML and API routes.
- `GET /api/admin/capacity` returns `401` unauthenticated, as expected.
- Real production D1 confirms all four migrations applied: `scan_diffs`'s FKs now show
  `on_delete: SET NULL` (were `NO ACTION`), `audit_continuations.scan_id` now shows
  `on_delete: CASCADE` (was `NO ACTION`), `scans.findings_omitted_count` exists, and the new
  composite index `idx_domains_monitoring_state_next_scan_at` exists — all via a real
  `PRAGMA foreign_key_list`/`sqlite_master` query against production, not assumed from the
  migration files alone. Table count unchanged at 42 (as expected — none of the four migrations
  added a table).
- Deployed Worker version: `7d1b4cc4-2232-4c21-9f91-5b154f94e5c2`.

**Known limitation disclosed during this deploy, not caused by it**: the preview environment
(`crawlpact-web-preview`) is separately missing `PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET` secrets,
causing `deploy-preview.yml`'s binding-verification step to fail — confirmed pre-existing (the
same failure hit the three unrelated preview deploys immediately before this one) and unrelated to
Phase 11's own build/migrate/deploy steps, which all succeeded on preview despite the later
verification step failing. Production's own secrets and binding verification are unaffected and
passed. This preview-specific gap needs a real secret value set on the preview Worker to fix —
routed to a future fix, not attempted here (no real secret value was available to set).

### Phase 11 — Database, Storage, Retention and Performance Hardening

Full detail: `docs/reports/PHASE_11_DATABASE_STORAGE_PERFORMANCE_COMPLETION_REPORT.md`.

#### Fixed

- `scan_diffs.previous_scan_id`/`current_scan_id` and `audit_continuations.scan_id` had no
  `ON DELETE` clause, risking an aborted daily retention purge (RISK-005) — migrations `0022`/
  `0023` add `ON DELETE SET NULL`/`CASCADE` respectively.
- Admin subscriptions/transactions views hid rows for later-deleted accounts (`INNER JOIN` to
  `users`, RISK-009) — changed to `LEFT JOIN` with a "Deleted account" label.
- A monitoring-sweep fairness bug (unspecified D1 row order could let newer domains starve an
  equally- or more-overdue one when the due backlog exceeded the batch cap) — `claimDueDomains`
  now orders by `next_scan_at ASC`.
- A real logic bug in this phase's own new retention-chunking code (backlog falsely reported when
  the eligible row count was an exact multiple of the chunk size) — caught by this phase's own
  test before shipping.

#### Changed

- `scan_resources` (`html_meta`/`sitemap` types) now stores a minimised evidence blob instead of
  the full raw fetched body — reduces the two largest storage contributors (RISK-007) by roughly
  two orders of magnitude; old rows remain readable via a format-detecting fallback.
- Scan persistence now uses a single atomic `db.batch()` call instead of ~30–76 individual
  statements per scan.
- Findings persistence now caps at 25 (severity-first, code-diverse selection), disclosing any
  omitted count in the report UI; RSL and sitemap parsers now have the same 200,000-byte
  pre-parse bound the HTML parser already had.
- The daily retention purge is now chunk-bounded, supports a real dry-run mode, and isolates each
  category's failure from the others.
- SSR responses now default to `Cache-Control: private, no-store` unless a page explicitly opts
  into public caching (`changelog`, `scanner`, `for/[slug]`, `status`).

#### Added

- `resource_hash` (previously unused) now populated for every fetched scan resource.
- An R2 orphan-cleanup admin action for the `AGENCY_LOGOS` bucket (bounded, dry-run-by-default).
- A read-only operational capacity admin view (`GET /api/admin/capacity`).
- A composite `domains(monitoring_state, next_scan_at)` index (migration `0025`).
- `pnpm lighthouse:check` now gates on the median of 3 runs (not 1), covers `/sample-report`, and
  uploads full per-run results as a CI artifact.

Deployed the same day — see "Production deployment (2026-08-05) — Phase 11" above for the real
deployment/verification evidence.

## Production deployment (2026-08-05) — Brand refresh and pricing-card alignment fix

PR #84 (squash-merged as `e902e6c`) deployed to production via `deploy-production.yml`, run
against commit `e902e6c78932995a64bbf83d317961bf170cccc2`. No new D1 migration (Worker/asset-only
release). The in-workflow smoke test passed; independently re-verified afterward directly against
the live site: `/`, `/status`, `/robots.txt`, `/sitemap.xml`, `/pricing`, and `/favicon.png` all
return `HTTP 200`; the retired `/favicon.svg` now correctly 404s; the homepage HTML references the
new `/branding/artwork1.png` and `/branding/crawlpact-icon.webp` assets; the `<link rel="icon">`
tag points at `/favicon.png`; and the pricing cards' markup contains the `mt-auto` button-alignment
fix. Deployed Worker version ID: `51bd702e-4dab-4d30-8f65-9205e4a03d6f`. Build artifact checksum:
`c3f65964f0aae4196ef6b806a288fd307c6baef8dc6e24eb499493785c23f293` (identical to Phase 7's — this
deploy changed only static assets and component markup, not the Worker's binding manifest that the
checksum covers, so an unchanged value is expected, not a sign the build didn't run).

### Changed

- Replaced the abstract "C-bracket" mark with a new shield-and-checkmark logo/icon across the
  favicon, header, footer, app nav, admin nav, and all `/og/*.png` social-preview images
  (`apps/web/src/components/BrandMark.astro` and its callers); removed the now-redundant colour
  badge wrapper around it since the new icon carries its own colour.
- Redrew the homepage hero illustration (`apps/web/public/branding/artwork1.png`): replaced the
  placeholder mark inside the magnifying-glass lens with a checkmark styled to match the lens's own
  glossy gradient and highlight treatment, with the browser-card line style echoed faintly inside
  the lens.
- Fixed pricing-card CTA misalignment on the homepage and `/pricing`: the "Most Popular" badge on
  the Pro card pushed its button out of line with the other three cards; cards are now full-height
  flex columns with the button pinned to the bottom (`PricingPlans.tsx`,
  `PricingPreviewSection.astro`).

## Production deployment (2026-08-04) — Phase 7

Phase 7 (Vertical Landing Pages and Platform SEO Architecture, PR #82, squash-merged as `4637e1a`)
deployed to production via `deploy-production.yml`, run against commit
`4637e1a224b8a49d4a44a7d5c42cd0ee65c5afbf`. No new D1 migration this phase (content-only). The
in-workflow smoke test passed; independently re-verified afterward directly against the live site:
all 10 new routes (`/for/{agencies,publishers,saas-and-documentation,web-developers}`, `/platforms`,
`/platforms/{cloudflare,wordpress,shopify,vercel,netlify}`) return `HTTP 200`, all 9 content pages
plus the `/platforms` static route appear in the live `/sitemap.xml`, `/for/agencies` renders its
real `<h1>` content, and the header nav's new "Platforms" link is present. Deployed Worker version
ID: `630258b4-c020-4105-9ca3-550897f7c0e3`. Build artifact checksum:
`c3f65964f0aae4196ef6b806a288fd307c6baef8dc6e24eb499493785c23f293` (checksums the Worker's
`wrangler.json` binding manifest, which is unchanged from Phase 6 — expected for a content-only
deploy, not a sign the build didn't run). See
`docs/reports/PHASE_07_VERTICAL_PLATFORM_SEO_COMPLETION_REPORT.md` for the full change list. As
documented throughout this phase, the 5 extended platform guides (nginx, apache, fastly, akamai,
GitHub Pages) were deliberately not built — RISK-031 remains open, tracked for a future session.

### Added — Phase 7: Vertical Landing Pages and Platform SEO Architecture

- Two new content collections, `verticals` and `platforms` (`apps/web/src/content.config.ts`).
- 4 audience-specific vertical landing pages at `/for/<slug>` (agencies, publishers,
  SaaS-and-documentation, web developers) — SSR (`prerender = false`), reading live pricing via
  the existing `getPlanCatalog()` (same source `pricing.astro` uses).
- A platform-guide hub at `/platforms` plus 5 verified, source-cited platform guides at
  `/platforms/<slug>` (Cloudflare, WordPress, Shopify, Vercel, Netlify) — prerendered, every
  technical claim traced to `docs/seo/PLATFORM_CLAIM_SOURCE_REGISTER.md` and rendered as a
  template-generated "Official references" section.
- 9 new first-party product events (`vertical_page_viewed`, `vertical_audit_cta_clicked`,
  `vertical_sample_report_clicked`, `vertical_pricing_clicked`, `platform_guide_viewed`,
  `platform_audit_cta_clicked`, `platform_official_source_clicked`,
  `platform_related_guide_clicked`, `content_correction_clicked` — see
  `docs/analytics/PHASE_07_CONTENT_CONVERSION_EVENT_MODEL.md`).
- New header nav link ("Platforms"), a homepage "Solutions" teaser section
  (`VerticalsSection.astro`), and a new footer "Solutions" column linking all 4 vertical pages and
  the platform hub.
- Two new quality-gate scripts: `pnpm content:validate` (wired into `pnpm quality`) and
  `pnpm content:links:check` (manual/scheduled — makes live network calls, so kept out of the
  network-independent `quality` gate).
- 14 new governance/content docs under `docs/seo/`, `docs/content/`, `docs/security/`,
  `docs/analytics/` — see `docs/governance/DOCUMENTATION_INVENTORY.md`'s "Phase 7 update" and
  `docs/reports/PHASE_07_VERTICAL_PLATFORM_SEO_COMPLETION_REPORT.md` for the full list.

### Deferred — Phase 7

- 5 extended platform guides (nginx, apache, fastly, akamai, GitHub Pages) — the phase prompt's own
  research/evidence/uniqueness bar wasn't attempted this session; explicitly not built rather than
  published thin. Tracked as RISK-031.

## Production deployment (2026-08-04) — Phase 6

Phase 6 (Pricing, Plan Architecture and Checkout Continuity, PR #80, squash-merged as `16d5864`)
deployed to production via `deploy-production.yml`, run against commit
`16d586419d09c2df39dc1411d079a21a18af0dd2`. One D1 migration was applied (`0021_plan_prices.sql`,
the new `plan_prices` table and 5 new `subscriptions` columns), followed by the newly-automated
reference-data seed step. The in-workflow smoke test passed; independently re-verified afterward
directly against the live site: `/pricing` renders all 7 real approved offers (Free $0; Solo
$9/mo, $89/yr; Pro $19/mo, $189/yr; Agency $39/mo, $389/yr, "Most Popular" badge on Pro), its
structured pricing data contains exactly 7 `Offer` entries at those same real prices, `/app/billing`
and `/admin/plans` both correctly redirect an unauthenticated visitor to `/sign-in`, and
`POST /api/billing/checkout` correctly rejects a cross-origin request with `403 FORBIDDEN`
(`Cross-site request blocked`). Deployed Worker version ID: `7ed25286-f394-4517-aca6-5fe5168b41a4`.
Build artifact checksum: `c3f65964f0aae4196ef6b806a288fd307c6baef8dc6e24eb499493785c23f293`. See
`docs/reports/PHASE_06_PRICING_PADDLE_CHECKOUT_COMPLETION_REPORT.md` for the full change list. As
documented throughout this phase, no real paid Paddle checkout was run as part of this deployment
— RISK-001 remains open.

### Added — Phase 6: Pricing, Plan Architecture and Checkout Continuity

- A DB-backed, multi-interval, multi-environment pricing catalog (migration
  `0021_plan_prices.sql`, `apps/web/src/lib/billing/plan-catalog.ts`) replacing the old flat
  annual-only `PADDLE_PRICE_ID_*` env-var mapping — real monthly and yearly Solo/Pro/Agency prices
  created live in Paddle production (`docs/billing/PADDLE_LIVE_CATALOG_MAP.md`) under a documented
  preflight/idempotency process (`docs/billing/PADDLE_LIVE_PREFLIGHT_CHANGE_MANIFEST.md`), with the
  3 pre-existing annual prices preserved as legacy, never-offered-for-new-checkout mappings
  (`docs/billing/LEGACY_PRICE_AND_SUBSCRIBER_POLICY.md`).
- Server-side plan-change (upgrade/downgrade/billing-cycle-change) support: real Paddle
  proration previews, immediate application for upgrades, and an application-level scheduled
  application for downgrades that never bills early and preserves current entitlements until the
  next period (`docs/billing/PLAN_CHANGE_AND_PRORATION_POLICY.md`; fixes RISK-017's "Upgrade to X"
  mislabelling defect) — `PlanChangeButton`/`BillingPlansSection` on `/app/billing`, plus a new
  Worker cron job (`applyDueScheduledDowngrades`) that applies due scheduled changes.
- Checkout continuity: a visitor's plan/interval choice on `/pricing` survives an unauthenticated
  sign-up/sign-in round trip and preselects on `/app/billing`, carrying only a semantic
  `plan`/`interval` pair, never a price ID or amount
  (`docs/billing/CHECKOUT_CONTINUITY_ARCHITECTURE.md`).
- A fully redesigned, always-live `/pricing` page (monthly/yearly toggle, full comparison table,
  structured `Offer` data for both intervals) reading the real catalog per-request; the homepage's
  pricing teaser shows marketing copy only, no price figures (avoids ever baking stale pricing
  into its prerendered static build).
- Super Admin `/admin/plans` now shows the full Paddle price catalog (per environment, legacy/
  active/archived status, live subscriber counts, last-verified date) with automatic reconciliation
  flags (missing/duplicate mappings, stray active legacy prices, orphaned archived prices);
  `/admin/subscriptions` now shows each subscriber's plan/interval, any scheduled change, and
  legacy/environment-mismatch flags.
- A read-only `pnpm paddle:catalog:verify <preview|production>` command reconciling the DB catalog
  against a live Paddle API read (`docs/billing/PADDLE_CATALOG_RECONCILIATION_RUNBOOK.md`).
- `docs/security/PHASE_06_BILLING_AND_CHECKOUT_THREAT_REVIEW.md` — a full threat review covering
  client-controlled pricing, legacy/environment price misuse, webhook race/idempotency,
  cross-account linking, open redirect, portal-URL leakage, admin entitlement override, and
  proration-preview/actual-charge mismatch, each mapped to the actual protecting code.
- 26 new tests: a unit suite for the upgrade/downgrade direction rule (both the server rule and its
  client-side label mirror), a new integration suite for checkout price resolution and the three
  plan-change endpoints (including client-price-tampering, free-plan, invalid-interval, CSRF, and
  no-active-subscription rejection cases), two new webhook integration tests (legacy-price
  resolution, unresolvable-price honesty), a real-browser e2e test for checkout continuity, an a11y
  check for `/app/billing`, and a responsive-smoke check for `/app/billing` at all 5 breakpoints.

### Changed

- `apps/web/src/pages/api/billing/checkout.ts` now accepts `{planId, interval}` and resolves the
  real Paddle price server-side via the new catalog — never trusts a client-supplied price ID or
  amount.
- The Paddle webhook processor now resolves `items[0].price.id` through the DB-backed catalog
  (legacy-aware) instead of flat env-var equality, and persists the resolved `paddle_price_id`/
  `billing_interval` on every subscription row.
- Both `deploy-preview.yml` and `deploy-production.yml` now run the idempotent reference-data seed
  step immediately after migrations, on every deploy — closes a real gap found while preparing this
  phase's own deployment (a new reference-data-dependent table, such as `plan_prices`, previously
  shipped empty until someone remembered to seed it manually; see
  `docs/billing/BILLING_DEPLOYMENT_AND_ROLLBACK_RUNBOOK.md`).

### Removed

- `apps/web/src/lib/billing/plan-mapping.ts`, `apps/web/src/lib/plans.ts` (and its guard-rail test
  asserting "no monthly pricing exists," necessarily removed since monthly pricing is now the
  point), and `packages/core/src/api/contracts/billing.ts` (RISK-016: dead code whose field names
  didn't match the real implementation).

### Known limitations (not fixed by this phase)

- **RISK-001 remains open**: no real, paid Paddle checkout has been run — this phase verified the
  live catalog (real prices created and read back), checkout-opening (server-side price
  resolution), and webhook processing (against the new price model), but deliberately did not
  trigger a real charge without separate, explicit authorization.
- **RISK-012** (the pre-existing flaky concurrent-webhook-race integration test) was not fixed in
  this phase despite being nominally targeted — touches billing-critical ordering logic and was
  judged to need dedicated review rather than a rushed change; carried forward.
- RISK-028 (SRS §2.3 tagline reconciliation) and the 10 missing `package.json` `"description"`
  fields, both carried forward from Phase 5, remain open and are carried forward again to Phase 7 —
  this phase's own prompt scoped it specifically to pricing/checkout.

## Production deployment (2026-08-04) — Phase 5

Phase 5 (Anonymous Audit Result and Account-Conversion Flow, PR #78, squash-merged as `c5efc97`)
deployed to production via `deploy-production.yml`, run against commit
`c5efc97ac9d223f3b31313ae9aed32a417aec22d`. One D1 migration was applied
(`0020_audit_continuations.sql`, the new `audit_continuations` table). The in-workflow smoke test
passed 32/32; independently re-verified afterward directly against the live site: homepage,
`/sign-in`, and `/app/continue` (correctly redirecting an unauthenticated visitor to `/sign-in`)
all responded correctly, `POST /api/audit/:auditId/continuation` correctly returned
`AUDIT_NOT_FOUND` for an unknown audit id, and a real anonymous audit run against
`e2e-fixture.crawlpact.com` produced a live report page containing both the new "Save and monitor
this domain" CTA and the new "Policy impact summary" section. Deployed Worker version ID:
`03180537-d303-4a48-a112-6f1e1af6c974`.

### Added

- A contextual "Save and monitor this domain" / "Save without monitoring" CTA on the anonymous
  audit report, driven by a new six-dimension policy-impact summary (`packages/core`'s report
  contract unchanged; the summary is a pure derivation, not a second evaluation engine); a
  DB-backed, single-use, 60-minute continuation record (migration `0020_audit_continuations.sql`)
  that carries the visitor's intent through sign-up/sign-in without ever including report content;
  a new authenticated handoff route (`/app/continue`) that adopts the original anonymous scan as
  the domain's starting result when eligible, or reruns it under the new account otherwise, and
  leaves monitoring paused until an explicit, separate "Enable monitoring" step. See
  `docs/product/AUDIT_CONVERSION_FLOW.md`, `docs/product/AUDIT_CONVERSION_STATE_MODEL.md`, and
  `docs/security/PHASE_05_AUDIT_CONVERSION_THREAT_REVIEW.md`.
- `isSafeRelativeRedirect()` (`apps/web/src/lib/auth/safe-redirect.ts`) — the first
  client-influenced post-authentication redirect this codebase has ever accepted; rejects absolute
  URLs, protocol-relative URLs, and backslash-normalisation tricks.

### Fixed

- `establishBaseline()` previously had a `"scan_missing"` failure reason in its type that could
  never actually be returned (the function fell through to a pointless rerun instead); it now
  returns that reason explicitly when the referenced scan doesn't exist.

## Production deployment (2026-08-04)

Phases 0-4 (PRs #68-#72; Phase 4 squash-merged as `e757cbb`) deployed to production via
`deploy-production.yml`, run against commit `e757cbb5a52cff8781cdc43442fe8518dbf4021b`. No D1
migrations were pending since the last deployment (`ca6c3c1`, 2026-07-31) — this was a
Worker-code-only release. The in-workflow smoke test passed 32/32; independently re-verified
afterward by running `scripts/smoke-test.ts production https://crawlpact.com` directly against the
live site: **32/32 checks passed**, including live confirmation that `/sample-report/` serves the
new sample-fixture report (`sample-domain.example`) and the homepage's new "View a sample report"
and "Review Agency pricing" CTAs are present. Deployed Worker version ID:
`120bcb7a-c1aa-45a7-8889-c4c47258713a`. Phases 0 and 1 (governance/documentation-only, PRs #68-#69)
carried no independent deployment action of their own — they took effect simply by being part of
the same commit history as Phases 2-4.

**Second deployment the same day**: investigating an intermittent CI failure on `main` (commit
`abab3d4`, and again on the CHANGELOG-only commit `a66f4e5` above) surfaced a real, previously
undetected billing bug — concurrent related Paddle webhook deliveries could silently regress a
subscription's status, both reporting `"processed"` with no visible error (see
`docs/status/BILLING_WEBHOOK_RACE_TEST_FLAKE.md`). Fixed in PR #74 (squash-merged as `53a56ce`):
replaced a racy out-of-order check against `webhook_events` with an atomic compare-and-swap on a
new `subscriptions.last_applied_occurred_at` column (migration `0019`). Deployed via
`deploy-production.yml` against `53a56cee69c40973a06317fb2b789c80e906e2bb` — migration `0019`
applied cleanly to live D1, Worker deployed, bindings verified. In-workflow smoke test passed
32/32; independently re-verified afterward against the live site: **32/32 checks passed**.
Deployed Worker version ID: `892561e5-2f27-4223-9fa2-e7f2db21ae03`.

**Third deployment the same day**: Public Country Reference and Contact Messaging Correction, at
explicit product-owner instruction. Removed every public reference to CrawlPact's operating
country/jurisdiction (previously "Sri Lanka", approved Phase 3) from `/about`, `/contact`,
`/privacy`, and `/terms` — not replaced with another location, city, region, or
"international"/"global" wording. `apps/web/src/lib/trust-config.ts` no longer exports a
`governingJurisdiction` field. `/terms` §21 "Governing law" was removed entirely (sections
renumbered §1–§22); tracked as **RISK-029** (`docs/risks/ACTIVE_RISKS.md`) pending professional
legal review before a jurisdiction can be republished. Rewrote `/contact`'s introduction: removed
"There is no live chat, phone support, or guaranteed response time" and replaced it with a
positive commitment ("we respond to enquiries within 24 hours"), plus a clarifying note that this
is the initial-response time, not a resolution guarantee. Approved contact addresses and
categories are unchanged. Extended `pnpm trust:validate` with prohibited-pattern checks
(country/jurisdiction references, negative support wording) and a required positive check (the
contact page's 24-hour response commitment), so the removed wording cannot silently return — see
`docs/reports/PUBLIC_COUNTRY_AND_CONTACT_MESSAGING_CORRECTION_REPORT.md`. Deployed in PR #76
(squash-merged as `6d2f91d`) via `deploy-production.yml` against
`6d2f91d1b7598b8b8aeea825a433ed742645de48` — no D1 migrations pending, Worker-only release.
In-workflow smoke test passed 32/32; independently re-verified afterward against the live site:
**32/32 checks passed**, including live confirmation that no page contains "Sri Lanka" and
`/contact` shows the 24-hour response commitment. Deployed Worker version ID:
`3363cee3-735a-4426-bf4b-35a79ebc071d`.

### Added

- Phase 2 (Brand Positioning and Messaging System): established
  `docs/brand/{BRAND_POSITIONING_AND_MESSAGING_SYSTEM,VOICE_AND_STYLE_GUIDE,
PRODUCT_TERMINOLOGY_GLOSSARY,CLAIMS_AND_MESSAGING_GUIDE,MESSAGING_SURFACE_INVENTORY,
GITHUB_BRAND_METADATA_MANIFEST}.md`, a central `apps/web/src/config/brand.ts` module, and
  `pnpm brand:validate` (wired into CI's `quality` job) — see
  `docs/reports/PHASE_02_BRAND_POSITIONING_MESSAGING_COMPLETION_REPORT.md`.

### Changed

- Centralised previously-duplicated brand strings (product name, category, canonical
  descriptions) into `apps/web/src/config/brand.ts` and wired it into `BaseLayout.astro`'s
  JSON-LD/`og:site_name`, the homepage `<title>`/meta description, `SiteFooter.astro`, and
  `SiteHeader.astro`.
- Corrected `AuditForm.tsx`'s primary CTA button from "Audit domain" to "Audit a domain", matching
  the wording already used consistently everywhere else in the product (`SiteHeader.astro`,
  crawler/guide detail pages) — updated the four e2e tests that referenced the old button text.
- Updated root `package.json`'s `description` field to match the new canonical public category.

### Not fixed (deliberately deferred, see `docs/brand/MESSAGING_SURFACE_INVENTORY.md`)

- SRS §2.3's Primary Tagline conflicts with the new canonical brand tagline — recorded as
  RISK-028, routed to Phase 3 for an SRS update or ADR, not silently edited.
- Raw scan-status enum display in the authenticated domain-detail scan-history list, and no
  customer-facing `scan_diffs` change-timeline UI — both routed to Phase 8.

### Added (Phase 3 — Legal Identity, Contact, Security and Trust Foundation)

- A `/contact` page, `/.well-known/security.txt` (RFC 9116), and a content/crawler-registry
  correction process on `/methodology` — none of these existed before this phase.
- `docs/trust/{LEGAL_AND_TRUST_SURFACE_INVENTORY,TRUST_AND_LEGAL_CONFIGURATION}.md`,
  `docs/security/RESPONSIBLE_DISCLOSURE_PROCESS.md`,
  `docs/privacy/{DATA_CATEGORY_AND_PURPOSE_INVENTORY,PRIVACY_REQUEST_PROCESS}.md`, and
  `pnpm trust:validate` (wired into CI) — see
  `docs/reports/PHASE_03_LEGAL_SECURITY_TRUST_COMPLETION_REPORT.md`.
- `ContactPoint` structured-data entries on `BaseLayout.astro`'s JSON-LD `Organization` node.

### Changed (Phase 3)

- Filled in `apps/web/src/lib/trust-config.ts`'s previously-`null` legal-identity fields with
  product-owner-approved values: operator name ("CrawlPact", no corporate suffix), governing
  jurisdiction ("Sri Lanka"), and five contact addresses (privacy/security/support/
  corrections/billing) — see `docs/trust/TRUST_AND_LEGAL_CONFIGURATION.md`. Registered address
  and registration number remain deliberately `null`.
- Rewrote `/privacy` and `/terms` to the full required structure (data-category distinctions,
  cookies, retention, billing/Paddle, rights, governing law, contact, etc.), verified directly
  against code (account deletion, data retention, Paddle cancellation/refund behaviour, analytics
  scope, IP handling).
- Corrected `/terms` and `/acceptable-use`'s "you may only submit domains you own, manage, or are
  otherwise authorised to audit" claim — verified against code that the free audit has no
  ownership-verification logic at all; reworded to require lawful and responsible use instead.
- Added a full responsible-disclosure policy (scope, contact, reporter guidance, prohibited
  testing, safe-harbour wording) to `/security`; updated the stale root `SECURITY.md` (previously
  said "no live scanner, authentication, billing, or admin surface exists yet").
- Added operator/jurisdiction wording and trust-route links to `/about`.
- Added a "Contact" link to `SiteFooter.astro` and `/contact` to `sitemap.xml.ts`.
- Updated `docs/release/LEGAL_INFORMATION_CHECKLIST.md` and RISK-011 (`docs/risks/ACTIVE_RISKS.md`)
  to reflect what's now resolved vs. still genuinely blocked (address, registration number, tax
  information). Re-routed RISK-004 to Phase 13 (Phase 3 is barred from changing analytics
  behaviour).

### Not fixed (deliberately deferred, see `docs/trust/LEGAL_AND_TRUST_SURFACE_INVENTORY.md`)

- Registered business address, registration number, and tax information — still genuinely
  unavailable, not invented (RISK-011, routed to Phase 18).
- No cookie-consent mechanism for Google Analytics (RISK-021) and no purge job for
  `product_events`/`security_events`/`notifications` (RISK-006) — both accurately disclosed in
  the rewritten Privacy Policy, neither resolved; routed to Phase 13 and Phase 11 respectively,
  per this phase's explicit scope boundary against changing analytics/retention behaviour.

### Added (Phase 4 — Homepage Information Architecture and Conversion Redesign)

- A new `/sample-report` page reusing the real `AuditReportView` component (the same one real
  reports use) with a new, schema-validated fixture (`apps/web/src/lib/sample-report.fixture.ts`)
  — no report-rendering logic was duplicated.
- Five new homepage section components under `apps/web/src/components/homepage/`
  (`RiskSection`, `SampleReportSection`, `CrawlerPurposeSection`, `AgencySection`,
  `PricingPreviewSection`).
- `apps/web/src/lib/plans.ts` — a single source for the plan data `pricing.astro` and the new
  homepage pricing preview both read, replacing a previously duplicated hand-typed array (same
  values, no price/limit/entitlement change).
- Five new homepage-specific analytics event names (`sample_report_clicked`,
  `homepage_pricing_clicked`, `homepage_agency_cta_clicked`, `homepage_methodology_clicked`,
  `homepage_crawler_directory_clicked`), tracked via a small unhydrated click-delegation script —
  no new client-side framework island.
- `docs/design/{PHASE_04_HOMEPAGE_BASELINE,HOMEPAGE_INFORMATION_ARCHITECTURE,
HOMEPAGE_CONTENT_MODEL,HOMEPAGE_COMPONENT_MAP}.md` — see
  `docs/reports/PHASE_04_HOMEPAGE_CONVERSION_REDESIGN_COMPLETION_REPORT.md`.

### Changed (Phase 4)

- Redesigned the homepage to a 12-section information architecture (see
  `docs/design/HOMEPAGE_INFORMATION_ARCHITECTURE.md`): added a dedicated crawler-policy-risks
  section, a dedicated agency/multi-domain workflow section, and a four-category crawler-purpose
  explainer; consolidated the former "Core features" and "Built for real workflows" card grids
  into the evidence/methodology and agency sections to avoid duplicate content.
- Kept the hero H1 and primary CTA label unchanged — both were already SRS-aligned and
  Phase-2-validated; changing them would have created a fresh, avoidable documentation deviation
  (see `docs/design/PHASE_04_HOMEPAGE_BASELINE.md` "Implementation decisions").
- Extended `apps/web/tests/e2e/responsive-smoke.spec.ts`'s viewport matrix (added 1440px/1920px)
  and added a `/sample-report` overflow check, per Phase 4's required viewport list.

### Verified (Phase 4)

- Production-build Lighthouse comparison (built `main` at `abab3d4` in a separate git worktree vs.
  this branch, both served statically): performance 99→99, accessibility 100→100, best practices
  96→96, SEO 100→100, LCP ~2114ms→~2113ms, CLS 0→0 — no measurable regression despite the new
  route and sections, because no new client hydration was added to the homepage itself.
- Fixed a real WCAG 2.2 AA violation surfaced by testing `/sample-report`: `AuditReportView`'s
  crawler-access-matrix table wrapper is now keyboard-focusable (`role="region"`, `tabIndex={0}`),
  following the same pattern already established in `packages/ui/src/components/DataTable.tsx` —
  benefits real report pages too, not just the sample page.

## Production deployment (2026-07-31)

PR #59 (this release's full change set, squash-merged as `e245793`) deployed to production via
`deploy-production.yml`. The `0018_incidents.sql` migration applied cleanly to the live D1
database; the Worker deployed and binding verification passed; the post-deploy smoke test then
caught a real regression: the rewritten `/status` page (part of #59) had silently dropped the
literal `"Free audit (real scan)"` / `"Available"` capability-honesty label the smoke test (and
the underlying `AUDIT_ENGINE_ENABLED` honesty requirement) depends on, replacing it with a
paraphrase. Production was live with this defect for approximately 45 minutes.

Fixed in a dedicated one-line hotfix (PR #60, squash-merged as `ca6c3c1`), verified locally
(fresh build, prettier, direct dev-server `curl`), CI-checked, and redeployed via a second
`deploy-production.yml` run against `ca6c3c1` — that run's smoke test passed in full. Independently
re-verified afterward by running `scripts/smoke-test.ts production https://crawlpact.com` directly
against the live site: **32/32 checks passed**, including live confirmation that
`robots.txt` now serves the corrected `Disallow: /audit/` form (PR #58), the homepage artwork
section is fully absent, the four trust-config-driven dates render correctly, and the new
Amazon crawler pages (`/crawlers/amzn-searchbot/`, `/crawlers/amzn-user/`) are live.

## Final release pass: robots.txt cleanup, homepage artwork removed, trust-metadata config (2026-07-31)

Full log: `docs/reports/CRAWLPACT_PRODUCTION_CONTENT_TRUST_SEO_AUDIT.md` §25 (final synthesis).

### Fixed

- Source-controlled `apps/web/public/robots.txt`: `Disallow: /audit/*` → `Disallow: /audit/`
  (the standard path-prefix form; the wildcard was non-standard and unnecessary since
  `Disallow: /audit/` already excludes everything under that path per RFC 9309). Landed and
  merged to `main` in PR #58 (commit `fd8eae5`), with a dedicated regression test
  (`apps/web/src/lib/robots-txt.test.ts`, 5 assertions) asserting no AI-crawler-specific
  directives are ever reintroduced into this file.

### Removed

- The homepage's inline-SVG "Policy Evidence Map" artwork section
  (`apps/web/src/components/PolicyEvidenceMap.astro`, wired into `index.astro`'s hero) — built and
  shipped earlier in this workstream, then removed at the product owner's explicit instruction
  before this release ("remove only the new section with the art work on the home page. It is not
  appropriate."). Fully removed with no residual references, imports, or CSS; verified via a clean
  rebuild and a direct grep of rendered HTML output for zero matches.

### Added

- `apps/web/src/lib/trust-config.ts` — a single typed source (`TRUST_CONFIG`) for trust-relevant
  facts referenced on multiple pages (billing/infrastructure/analytics providers, policy
  effective dates, registry/ruleset version labels, data-retention summary), so a date or provider
  name is defined once instead of re-typed identically across `privacy.astro`, `terms.astro`,
  `acceptable-use.astro`, and `methodology.astro`. Legal-identity fields
  (`legalEntityName`, `registeredAddress`, `governingJurisdiction`, `securityContact`,
  `privacyContact`, `correctionsContact`) are explicitly `null`, not a placeholder string — see
  `docs/release/LEGAL_INFORMATION_CHECKLIST.md`, which nothing in this repository fabricates a
  value for. Wired the four legal/methodology pages to read their "Effective and last updated" /
  "Last substantive update" dates from this config instead of a hand-typed literal string;
  rendered output verified unchanged (`30 July 2026`, `31 July 2026`).

### Clarified (no behavioral change)

- Reworded `docs/release/LEGAL_INFORMATION_CHECKLIST.md` and its `docs/status/KNOWN_RISKS.md`
  entry from "release blocker" to "deferred, scoped items only" — the missing legal-identity
  information blocks a specific, named set of items (governing-law clause, named data controller,
  `/.well-known/security.txt`, a public corrections channel), not this release as a whole. This
  reflects the product owner's explicit 2026-07-31 instruction to proceed with release despite
  this known, tracked, and honestly-disclosed gap.

## Cloudflare AI-bot block resolved; platform-specific guide content added (2026-07-31)

Full log: `docs/reports/CRAWLPACT_PRODUCTION_CONTENT_TRUST_SEO_AUDIT.md` §24.

### Fixed

- **CrawlPact's own production `robots.txt` no longer blocks the AI crawlers its product audits.**
  The product owner disabled Cloudflare's Managed robots.txt / AI-bot-blocking feature in the
  dashboard (not something this session's API token has permission to read or change).
  Independently re-verified by fetching live production `robots.txt` directly: it now matches
  `apps/web/public/robots.txt` exactly, with no Cloudflare-managed block and none of the
  previously-present per-crawler `Disallow` rules. No repository file changed for this fix — it
  was a Cloudflare zone-configuration change outside version control.

### Added

- Concrete, source-verified platform-specific implementation steps (Netlify `_headers`, Vercel
  `vercel.json`, Cloudflare Pages/Workers `_headers`, WordPress `functions.php`/plugin) added to
  `how-to-set-the-content-signal-header.md`, `how-to-publish-an-llms-txt-file.md`, and
  `how-to-publish-an-rsl-declaration.md`, replacing "consult your platform's own documentation"
  with actual syntax — Netlify and Vercel syntax verified directly against current official docs.

### Still unresolved (confirmed independently, not modified)

Legal entity name, registered address, jurisdiction, and contact details
(`docs/release/LEGAL_INFORMATION_CHECKLIST.md`) — every field still reads `(not provided)`.

## Crawler page "Site-owner controls" standardization (2026-07-31)

Full log: `docs/reports/CRAWLPACT_PRODUCTION_CONTENT_TRUST_SEO_AUDIT.md` §23.

### Changed

Replaced generic "Standard robots.txt disallow rules apply" boilerplate (or added a missing
section entirely) on 14 crawler-reference pages with crawler-specific content explaining what
blocking that token affects and which sibling tokens from the same operator remain unaffected:
`amazonbot.md`, `googlebot.md`, `googleother.md`, `google-cloudvertexbot.md`,
`meta-externalads.md`, `meta-externalfetcher.md`, `meta-webindexer.md`, `amzn-searchbot.md`,
`amzn-user.md`, `applebot-extended.md`, `ccbot.md`, `meta-externalagent.md`, `oai-searchbot.md`,
`perplexitybot.md`. `gptbot.md` and `google-extended.md` were reviewed and found to already meet
the bar under a differently-named heading — left unchanged. No frontmatter, metadata, or test
changes required; `lastVerified` dates intentionally not bumped (facts reused from already-verified
data on file, not freshly re-checked against a primary source this pass).

## Crawler and guide content-completeness pass (2026-07-31)

Full log: `docs/reports/CRAWLPACT_PRODUCTION_CONTENT_TRUST_SEO_AUDIT.md` §22.

### Added

- Crawler pages (`crawlers/[slug].astro`, applies to all 22 pages identically): an example
  `robots.txt` block generated from each crawler's real token, a wildcard-fallback explanation,
  a link to the AI crawler checker tool, and a source-verification note linking to
  `/methodology#registry-verification` (new anchor added to that heading).
- `relatedCrawlerSlugs` field on the guides content schema, set on the 7 guides genuinely about
  specific crawlers — crawler pages now show a real "Related guides" section derived from this,
  not keyword-matching.
- Tool links added to 5 decision guides that named the AI crawler checker's use case without
  linking to it; `google-extended-vs-googlebot.md` fixed to link to both crawler pages it discusses
  by name (previously linked to neither despite mentioning both repeatedly).

### Fixed

- A repeat instance of the round-5 Astro whitespace-collapsing bug, introduced by this round's own
  new template code — caught by re-running the same static sweep before shipping, fixed and
  verified via rendered HTML.

## Editorial policy, incident tracking system, trust-metadata config (2026-07-31)

Full log: `docs/reports/CRAWLPACT_PRODUCTION_CONTENT_TRUST_SEO_AUDIT.md` §21. Design doc for the
incident system: `docs/architecture/INCIDENT_TRACKING_SYSTEM_DESIGN.md`.

### Added

- `docs/seo/EDITORIAL_SOURCE_AND_CONTENT_POLICY.md` — editorial ownership, acceptable sources,
  conflict resolution, review workflow, and an explicit, honest statement of how AI assistance is
  used in producing content.
- **Incident tracking system**: `packages/database/migrations/0018_incidents.sql` +
  `schema/incidents.ts` (two new, purely additive tables — `incidents`, `incident_updates`;
  actor references nullable with `ON DELETE SET NULL` from the start), `lib/status/components.ts`
  (canonical component list), `lib/admin/incidents.ts` + `api/admin/incidents/**` (admin
  create/update, mirroring the existing `system_notices` feature's auth/audit pattern),
  `components/admin/IncidentsManager.tsx` + `pages/admin/incidents/index.astro` (Super Admin UI,
  added to `AdminNav.astro`), `lib/status/public-status.ts` (the public status adapter —
  incidents can only escalate a component's status, never mask a worse internal signal).
  `status.astro` rewritten to show overall status, per-component status, current incidents with
  full update timelines, scheduled maintenance, recently-resolved incidents, and an honest
  "no uptime measurement exists yet" statement instead of a fabricated percentage.
- `docs/release/LEGAL_INFORMATION_CHECKLIST.md` — every required legal field explicitly marked
  `(not provided)`; no value invented.
- `docs/status/BILLING_WEBHOOK_RACE_TEST_FLAKE.md` — precise root cause (the test's
  `Promise.all`-fired requests can complete in either order; the handler's out-of-order protection
  is correct, the test's fixed-outcome assertion is not) and recommended remediation. Neither the
  handler nor the test was changed.
- Tests: `admin-incidents.integration.test.ts` (8 tests, real D1) and `status/components.test.ts`
  (4 unit tests).

### Fixed

- **12 instances of a real, sitewide Astro whitespace-collapsing bug** (`<code>`/`<a>` content
  directly abutting the preceding word with no rendered space, e.g. "Try<code>example.com") across
  7 files — including one on the homepage hero that predates this workstream, confirming it's a
  genuine pre-existing pattern. All fixed with an explicit `{" "}` separator and verified via
  direct HTML output inspection, not just re-reading the source.

### Deliberately not done

- The new migration was applied to the **local** D1 database only, to exercise the feature during
  development — not to production. Applying it to production and deploying this code are separate
  production-infrastructure actions requiring their own explicit authorization.
- No legal-page rewrites requiring jurisdiction/legal-entity information.
- No change to the billing webhook handler or its out-of-order protection.

All notable changes are grouped by development "Part," per `docs/product/CRAWLPACT_FINAL_SRS.md`
§37.

## Production Content, Trust, and SEO Audit — Phase 7/8/10 gaps (2026-07-31)

Continuation of the audit below. Full log: `docs/reports/CRAWLPACT_PRODUCTION_CONTENT_TRUST_SEO_AUDIT.md` §19.

### Added

- `/crawlers`: computed (never hard-coded) crawler-page count, operator count, and latest
  verification date, plus a "how entries are verified" explainer.
- `/tools`: a "tool vs. full audit" explainer, per-tool signal labels, and a "how these work"
  section — previously just a title and five one-line links.
- `/methodology`: a signal-support matrix (what CrawlPact can/cannot infer per signal, with
  accurate specification-maturity notes) and a last-substantive-update date.
- `/about`: one paragraph distinguishing CrawlPact from a WAF, crawler blocker, log-analytics
  service, or general-purpose SEO crawler.

### Fixed

- A real WCAG violation (`scrollable-region-focusable`) on the new methodology table, caught by
  `pnpm test:a11y`, fixed by applying the same `tabindex`/`role`/`aria-label` pattern already used
  on `pricing.astro`'s comparison table.

## Production Content, Trust, and SEO Audit — P0/P1/P2 fixes (2026-07-30)

Full findings and implementation log: `docs/reports/CRAWLPACT_PRODUCTION_CONTENT_TRUST_SEO_AUDIT.md`.

### Fixed

- Removed the "Draft — not yet reviewed by a lawyer" banner from `/privacy`, `/terms`, and
  `/acceptable-use`.
- Removed "Super Admin Control Center" from the public `/status` capability list.
- Removed three leaked internal `SRS FR-xxx`/`§xx` citations from user-facing strings: the
  homepage FAQ (+ its `FAQPage` JSON-LD), a public guide, and the passkey-removal API error.
- Fixed a canonical/redirect mismatch affecting every crawler and guide detail page — the
  canonical tag pointed at a non-trailing-slash URL that itself 307-redirected, instead of the
  URL Cloudflare actually serves. Sitemap and internal "Related" links updated to match.
- Fixed a dead citation URL for the `Google-Extended` registry entry.
- Added visible effective/last-updated dates to `/privacy`, `/terms`, `/acceptable-use`.
- Unified the previously hand-duplicated CSP/security headers between `middleware.ts` and
  `public/_headers` into one shared source (`lib/security-headers.ts`), with a test asserting the
  two stay in sync.
- **Social preview images were silently broken on every page**: the site served a single SVG for
  `og:image`, but Facebook, X, LinkedIn, Slack, Discord, WhatsApp, and iMessage do not reliably
  render SVG as a link-preview image. Replaced with real PNGs (1200×630), rasterized from source
  SVGs via Playwright (already a project dependency — no new dependency, no image-generation
  service) by `scripts/generate-og-images.mjs`, with category-specific variants for the homepage,
  crawler directory, guides, and tools.

### Added

- `Amzn-SearchBot` and `Amzn-User` as separate crawler-registry entries and public reference
  pages, verified directly against Amazon's own documentation, consistent with how other
  multi-token operators (OpenAI, Anthropic, Perplexity, Meta) are already modeled. Publishing this
  as production's active registry release still requires a proper release-publish action — noted
  as a manual follow-up in `docs/registry/CRAWLER_REGISTRY_GOVERNANCE.md`.
- `WebApplication` structured data on `/pricing`, built from the same `plans` array the visible
  pricing table renders (no separate, driftable data).
- `HowTo` structured data on guides with genuine `Step N:` headings (4 guides qualified).
- Substantive "What this checks" / "What this doesn't check" / "Related" content on all 5 free
  tool pages, which previously had only a form and a one-line description.

### Investigated, not resolved here

- CrawlPact's own production `robots.txt` (via a Cloudflare-managed "Managed content" block)
  disallows GPTBot, ClaudeBot, Google-Extended, CCBot, Applebot-Extended, Amazonbot, Bytespider,
  and `meta-externalagent` from crawling `crawlpact.com` itself. Traced to Cloudflare's Bot
  Management `ai_bots_protection` zone setting — but the connected API token lacks the Bot
  Management permission scope, so it could not be read or changed via API. Needs either a broader
  token scope or a manual change in the Cloudflare dashboard (Security → Bots).
- Legal entity name, registered address, jurisdiction, and a verified contact channel remain
  undetermined — deliberately not fabricated. Recorded as a release blocker; blocks `/terms`'
  governing-law clause and a real `/.well-known/security.txt`.

## Release-Flow Remediation Phase 2 — Shared Auth Fixtures, Automerge Reliability (2026-07-30)

### Added

- `apps/web/tests/e2e/setup/customer.setup.ts` / `admin.setup.ts` — Playwright "setup project"
  fixtures that register one real account each, save authenticated `storageState`, and let other
  specs opt in via `test.use({ storageState: ... })` instead of re-running a real WebAuthn
  ceremony. `admin-flows.spec.ts` (4 tests) and `responsive-smoke.spec.ts` (2 tests) migrated,
  cutting 6 independent ceremonies down to 2. See `docs/testing/TEST_STRATEGY.md`.

### Fixed

Three real bugs found while `merge-when-green.yml` handled its first few automated merges (PR
#44-#47) — all now self-healing for future PRs:

- Merges made with the workflow's default `GITHUB_TOKEN` never triggered `ci.yml`'s `push`
  trigger on `main` (documented GitHub anti-recursion behavior) — `deploy-production.yml`'s
  "CI succeeded for this exact commit" check would have permanently refused every automerged
  commit. Fixed by adding `workflow_dispatch` to `ci.yml` and having `merge-when-green.yml`
  explicitly call it after a successful merge.
- That fix itself needed `actions: write`, missing from the workflow's `permissions:` block —
  added.
- `ci.yml`'s new `workflow_dispatch` trigger made `gitleaks-action` fall back to a full-history
  scan (no commit range to diff incrementally) instead of its usual incremental scan, surfacing
  `PUBLIC_PADDLE_CLIENT_TOKEN` — a value that's intentionally public (Paddle.js needs it
  client-side, already documented as such) — as a false-positive leak. Fixed with a narrow
  `.gitleaks.toml` allowlist entry for that one value; the real ruleset is unchanged.

See `docs/status/KNOWN_RISKS.md` for full root-cause detail on each.

## Release-Flow Remediation Phase 2 — Nav Overflow Fixes (2026-07-30)

Fixed the two real, disclosed responsive-layout bugs the new `responsive-smoke.spec.ts` suite
surfaced during Phase 1 (see `docs/status/KNOWN_RISKS.md`), rather than leaving them deferred.

### Fixed

- **`SiteHeader.astro`'s desktop nav overflowed at 640/768px** (the "Audit domain" button ran
  off-screen) — the nav switched on at this project's remapped `md:` breakpoint (640px, not
  Tailwind's stock 768px the original bug report mischaracterized it as), too narrow for the full
  row. Moved the switch to `xl:` (1024px).
- **Customer dashboard (`AppNav.astro`) had no mobile nav at all** — built `AppMobileNav.tsx`
  mirroring the existing `MobileNav.tsx`/`AdminMobileNav.tsx` pattern.
- **Super Admin shell's header bar overflowed at 360/768px** — not the sidebar (`AdminMobileNav`
  already worked correctly), but the surrounding header's display name and "Customer view" link
  rendering unconditionally. Hid the display name below `sm:`, made "Customer view" icon-only
  below `xl:`.
- Corrected several stale doc/comment claims describing this project's remapped breakpoint scale
  (`packages/ui/src/tokens/tokens.css`) using Tailwind's stock `md:`/`lg:` meanings.

## Release-Flow Remediation — CI Redesign, Visual Regression Removal (2026-07-29)

Made the development/release flow fast, deterministic, and free of repository-controlled
blockers, per a full audit of GitHub Actions history, live GitHub/Cloudflare/Paddle
configuration, and this repo's own accumulated `KNOWN_RISKS.md` evidence.

### Removed

- **Pixel-by-pixel visual regression** (`.github/workflows/visual-regression.yml`,
  `playwright.visual.config.ts`, `apps/web/tests/visual/**`, ~51MB of committed baseline PNGs) —
  it failed ~9.5% of the time on a re-run of an identical, already-baselined commit, and a
  readiness-signal fix attempt (commit `51f984b`) did not resolve it. See
  `docs/architecture/adr/ADR-0008-remove-pixel-visual-regression.md`.

### Added

- `apps/web/tests/e2e/responsive-smoke.spec.ts` — deterministic functional responsive tests
  (no horizontal overflow, key content reachable, mobile nav usable, keyboard focus visible) at
  360/768/1280px, replacing the removed visual suite.
- `pnpm ui:review` (`scripts/ui-review.ts`) — optional, git-ignored screenshots for manual human
  review only; never a CI gate or committed baseline.
- `pnpm verify:push` (`scripts/verify-push.sh`) and `pnpm check:fast` — local commands that
  reproduce the required CI gate (and a fast subset of it) before pushing.
- `.github/workflows/merge-when-green.yml` — an owner-controlled auto-merge substitute (squash-
  merges an `automerge`-labeled PR once CI succeeds for its exact head SHA), since this
  repository's GitHub plan can't gate native auto-merge on required status checks (branch
  protection returns `403`, confirmed live).
- `docs/architecture/adr/ADR-0008-remove-pixel-visual-regression.md`.

### Changed

- `.github/workflows/ci.yml` redesigned: `quality` and a new `browser-smoke` job now run
  concurrently (no `needs:` dependency), with a `ci-gate` aggregate as the one required check.
  `browser-smoke` runs required Chromium-only E2E/accessibility tests (one worker, one retry — a
  flaky test is now a real reported failure, not silently re-run green). Testing against a real
  built Worker (`wrangler dev --local`) instead of Astro's dev server was attempted and reverted
  after it reproducibly crashed the dev server when a test's direct D1 write (a separate
  `wrangler d1 execute --local` process) ran concurrently with the live server's own D1
  connection — a disclosed follow-up, see `docs/status/KNOWN_RISKS.md`.
- `seo-metadata.spec.ts`'s canonical-tag check now compares against the final served URL rather
  than the pre-redirect request path, normalizing trailing slashes — the real Cloudflare Assets
  binding 307-redirects extension-less paths to their trailing-slash form (confirmed the same in
  production today), which Astro's dev server doesn't exercise but was briefly tested against
  while designing this change.
- Repository merge settings: squash-only (`allow_merge_commit`/`allow_rebase_merge` now `false`),
  `delete_branch_on_merge` now `true`.

### Known, disclosed gaps from this pass (see `docs/status/KNOWN_RISKS.md`)

- `deploy-preview.yml` is currently broken (a GitHub Environment secret naming mismatch) —
  requires the repository owner to reset the `preview` Environment's secrets, since it needs a
  live credential value this session shouldn't handle.
- The customer dashboard and Super Admin shell nav bars genuinely overflow at 360/768px (a
  pre-existing, disclosed, out-of-scope bug the new responsive-smoke tests surfaced).
- The public site's `SiteHeader` desktop nav genuinely overflows at exactly 768px (Tailwind's
  `md:` breakpoint, where it switches on, is narrower than the nav actually needs) — found via a
  real CI run, disclosed and out of scope here.
- Deeper E2E stability work (shared auth fixtures instead of ~13 independent passkey
  registrations, a deterministic SSRF-safe scanner test target to remove the `example.com`
  dependency from required CI) is deliberately deferred to a follow-up pass.

## Post-Launch Trust Fixes — Legal Pages, Domain Re-save, Branding (2026-07-29)

Two direct `wrangler deploy` pushes straight to production this session (bypassing the guarded
`scripts/build.sh` pipeline added below) put a stale build live again, re-surfacing the
"Local Development environment" banner bug on `crawlpact.com`'s marketing pages. Root cause
was already fixed 2026-07-27 (see below); it only reproduces when deploying from a build that
didn't go through `scripts/build.sh`, e.g. a local `wrangler deploy` run from a machine with a
`.dev.vars` file present. No code change needed here — the fix is deploying through the gated
`deploy-production.yml` workflow, which builds from a clean checkout.

### Fixed

- **Privacy Policy, Terms, and Acceptable Use all cited a nonexistent SRS section.** Every one
  said "Draft, pending formal legal review before production launch (see SRS §39)" — the SRS
  has no §39, and no section anywhere addresses legal review. Live since the very first commit,
  on pages real signed-up users rely on. Replaced with an honest notice that doesn't cite a
  document it isn't in: "Draft — not yet reviewed by a lawyer."
- **Re-saving a previously-removed domain returned a generic 500.** `domains` had a table-wide
  `UNIQUE(owner_user_id, canonical_origin)`, but removal is a soft delete (`deleted_at` only);
  the app's duplicate check filtered to live rows, missed the leftover soft-deleted row, and hit
  the real unique index on insert. Replaced with a partial unique index scoped to
  `WHERE deleted_at IS NULL` (migration `0017_domains_unique_origin_excludes_soft_deleted.sql`,
  applied to production D1).

### Added

- A real CrawlPact logo mark (SRS §10.13) wired into favicon, OG image, public header, app nav,
  admin sidebar, footer, and printed/exported audit reports (§10.44) — all previously showed
  plain text or a placeholder letter.

## Release-Engineering Hardening — CI/CD Pipeline, Environment Contract, Live Production Bugs (2026-07-27)

Full audit and implementation of the development-to-production lifecycle: git/GitHub/Cloudflare/
Paddle read-only reconciliation, then a focused branch implementing the fixes. See
`docs/architecture/adr/ADR-0007-DEPLOYMENT-PIPELINE.md` for the full reasoning.

### Fixed

- **CI had failed on every push since `gitleaks-action` was introduced** — `results.sarif` written
  to the repo root broke `pnpm format:check` every single run; no prior "quality gate passed"
  claim in any commit message was ever actually confirmed green in CI. Fixed via
  `.prettierignore`/`.gitignore`.
- **Production's prerendered marketing pages shipped a "Local Development environment" banner**
  baked into the static HTML — root cause: Astro's Cloudflare adapter resolves environment
  variables for static prerendering from a machine-local `.dev.vars` file first, regardless of
  shell env vars or `CLOUDFLARE_ENV`. `scripts/build.sh` now refuses to build for preview/production
  if `.dev.vars` exists anywhere in the checkout.
- **Prerendered/static pages served zero security headers** (no CSP, `X-Content-Type-Options`,
  HSTS) — they bypass `middleware.ts` entirely via the Workers Assets binding.
  `apps/web/public/_headers` now carries the same header set.
- **`env.preview.vars` in `apps/web/wrangler.jsonc` was missing `PADDLE_PRICE_ID_*` and
  `PUBLIC_PADDLE_CLIENT_TOKEN` entirely** — `vars` is non-inheritable per named environment in
  Wrangler's model, so preview never had these at all. Caught by the new `pnpm env:validate:preview`.
- **`PUBLIC_PADDLE_CLIENT_TOKEN` was missing from the canonical Zod env schema**
  (`packages/config/src/env.ts`) despite being required everywhere else.
- Preview's `PUBLIC_SITE_URL`/`WEBAUTHN_RP_ID`/`WEBAUTHN_RP_ORIGIN` referenced
  `preview.crawlpact.com`, which doesn't exist — updated to the real, confirmed-live
  `crawlpact-web-preview.rmtlbandara.workers.dev`.
- Checkout and customer-portal-session API routes did not check whether billing was actually
  configured before handing back a (possibly placeholder) Paddle client token — now gated by
  `isPaddleBillingConfigured()`, returning a controlled `SERVICE_UNAVAILABLE` instead.

### Added

- `BILLING_ENABLED` environment flag (local/preview `false`, production `true`) as the
  authoritative deployment-intent gate, cross-validated against `PADDLE_ENVIRONMENT`/
  `PUBLIC_APP_ENV` (local/preview can never carry a live Paddle credential, enforced by a Zod
  `.superRefine()`, not just convention).
- `scripts/env-validate.ts`, `scripts/build.sh`, `scripts/deploy.sh`,
  `scripts/verify-bindings.ts`, `scripts/smoke-test.ts` and the matching `pnpm env:validate:*` /
  `build:*` / `deploy:*` / `smoke:*` scripts.
- `.github/workflows/deploy-preview.yml` (automatic after CI succeeds on `main`) and
  `.github/workflows/deploy-production.yml` (`workflow_dispatch`, typed confirmation, commit must
  be contained in `main`) — the first automated deploy path this repository has ever had.
- `.github/PULL_REQUEST_TEMPLATE.md`, `.github/dependabot.yml`, `.vscode/` workspace config.
- `docs/architecture/adr/ADR-0007-DEPLOYMENT-PIPELINE.md`,
  `docs/deployment/GITHUB_ACTIONS_DEPLOYMENT.md`, `docs/deployment/GITHUB_DESKTOP_WORKFLOW.md`,
  `docs/release/RELEASE_CHECKLIST.md`, `docs/release/ROLLBACK_RUNBOOK.md`.

### Documentation

Corrected several stale claims found during this pass: `IMPLEMENTATION_STATUS.md` and
`KNOWN_RISKS.md` still described the repository as having zero Git commits;
`PADDLE_LIVE_CONFIGURATION_REPORT.md` and `PADDLE_LIVE_GO_LIVE_CHECKLIST.md` still described
`/pay` as unbuilt after it had shipped; `CLOUDFLARE_ENVIRONMENT_MATRIX.md` said production's
Paddle vars were "Not set" after they'd been confirmed live; `BACKUP_AND_RECOVERY.md` and
`CLOUDFLARE_UPGRADE_TRIGGERS.md` still said no production Cloudflare account existed. See
`docs/status/KNOWN_RISKS.md`'s "Release-engineering hardening pass" section for the full list,
including new findings not yet resolved (Cloudflare Workers Builds' broken competing deploy
integration, a Paddle webhook secret inadvertently surfaced in this session's transcript, GitHub
branch protection unavailable on the current plan).

## Cloudflare Infrastructure Alignment — Capacity Audit and Analysis (2026-07-26)

A 23-phase brief requested full alignment of CrawlPact's architecture with an approved Cloudflare
plan (Workers, D1, R2, Workers Static Assets/Pages, DNS/SSL/CDN, Cron Triggers, Paddle). Per the
user's explicit scope: R2 is not adopted (no current technical need), the analysis is framed
around extending Workers Free headroom rather than assuming an immediate Paid upgrade, and all
documentation/analysis phases were completed while risky code changes (wrangler.jsonc hardening,
cache-header implementation, D1 write batching, new tests) were deliberately deferred. See
`docs/status/IMPLEMENTATION_STATUS.md`'s matching entry for the full document list.

### Added

- **Verified current Cloudflare Free-plan limits** (`docs/deployment/CLOUDFLARE_RESOURCE_LIMITS.md`) —
  ~27 limits fetched live against official docs, including confirming D1's 500MB per-database cap
  is distinct from its 5GB account-wide total, and that Cloudflare Pages' "unlimited" claim is
  scoped to static-asset requests only, not Functions/dynamic requests.
- **A full current-state Cloudflare architecture audit** (`docs/deployment/CLOUDFLARE_ARCHITECTURE_AUDIT.md`)
  confirming R2 is unused anywhere in the codebase, production/preview D1 are structurally
  separate, and scan evidence lives entirely in D1 as capped TEXT.
- **ADR-0006**, formalizing the decision to keep Workers Static Assets over a Cloudflare Pages
  split, with the honest caveat that Workers Static Assets requests likely count against the
  shared Workers daily-request budget (unlike Pages' exempt static-asset requests) — not
  independently verified, flagged as a follow-up.
- **A D1/R2 data placement policy** (`docs/data/D1_R2_DATA_PLACEMENT_POLICY.md`) concluding R2 is
  not justified today, with five concrete, evidence-based triggers that would reopen the decision.
- **A D1 storage capacity model** (`docs/data/D1_STORAGE_CAPACITY_AUDIT.md`) finding the production
  database is expected to reach 45–70% of its 500MB cap within one year, and cross it entirely
  between year 1–2, at the SRS's own commercial target — driven by `scan_resources`'s `html_meta`
  rows capturing full homepage HTML rather than just meta tags, compounding across Pro/Agency's
  multi-year retention windows.
- **A scan capacity budget and monitoring capacity plan**
  (`docs/operations/SCAN_CAPACITY_BUDGET.md`, `docs/operations/MONITORING_CAPACITY_PLAN.md`)
  quantifying, for the first time, that a real scan's CPU cost (≈3–7ms typical, ≈12–25ms+ worst
  case) leaves thin-to-negative margin against Workers Free's 10ms ceiling — driven by an
  unbatched D1 write fan-out and an uncapped findings count — and that the scheduled monitoring
  sweep's current 20-domain default batch size is "essentially certain" to exceed that same
  ceiling, with backlog modeled to begin between 5 and 50 Solo customers.
- **Concrete upgrade triggers** (`docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md`) and a **CDN
  cache policy** (`docs/deployment/CDN_CACHE_POLICY.md`, policy only — header implementation
  deferred) turning the above into warning/action thresholds.
- **A capstone capacity and cost report** (`docs/release/CLOUDFLARE_CAPACITY_AND_COST_REPORT.md`)
  synthesizing all of the above into a recommended launch configuration.

### Documentation corrections made along the way

- `docs/architecture/ARCHITECTURE.md` still described authentication, billing, monitoring, the
  scanner, and Super Admin as "architected for but not implemented" — stale since Part 1; all are
  now real, built features.
- `docs/deployment/ENVIRONMENTS.md` still described the environment indicator banner as pending
  ("once implemented") — it has been live since Part 3 Step 26.
- `docs/data/DATA_MODEL.md`'s migration table stopped at migration 8 of the now-16 that exist.

### Discovered, not fixed (out of scope for this docs-only pass — see `docs/status/KNOWN_RISKS.md`)

An unbatched D1 write fan-out and uncapped findings count in the scan-persistence path; a missing
`ON DELETE CASCADE` on `scan_diffs.previous_scan_id`/`current_scan_id` (same bug class as three
previously-fixed migrations); `product_events`/`security_events`/`notifications` having no purge
job; RSL parsing's missing pre-parse size bound; a sitemap sparse-`<loc>` full-scan gap; and the
scanner's subrequest counter undercounting true consumption by excluding redirect hops.

## UI/UX Conversion Audit — Trust and Consistency Fixes (2026-07-26)

A full route-by-route UI/UX and conversion audit (`docs/design/UI_UX_CONVERSION_AUDIT.md`) found
the product already faithful to the SRS and honest, with a short list of concrete, verifiable
bugs rather than a generic look needing a rebrand. This entry covers those fixes only — no new
brand/logo system or homepage rebuild was in scope for this pass.

### Fixed

- **Policy Health Score category breakdown now reaches real reports.** `computePolicyHealthScore`
  (`packages/policy/src/scoring.ts`) always computed a per-category breakdown, but it was
  discarded before persistence (`persist-scan.ts`) and absent from the API contract
  (`policyHealthScoreSchema`) — every real report (anonymous, saved-domain, shared-link) showed a
  bare score number, while only the landing page's synthetic demo showed the category detail.
  Added `scans.score_breakdown` (migration `0016_scan_score_breakdown.sql`), threaded it through
  the contract, `persist-scan.ts`, and `get-scan-report.ts`, and wired it into
  `AuditReportView`'s `ScoreComponent`. Also extracted the score→label mapping
  (`scoreLabelFor`) into `packages/policy` as the single source of truth, removing a duplicate
  private copy in `get-scan-report.ts`.
- **Domain detail page's score had no label.** `apps/web/src/pages/app/domains/[domainId].astro`
  passed a hardcoded empty label; now uses the shared `scoreLabelFor` helper.
- **Pricing page (`/pricing`) CTAs brought to parity with the homepage's own pricing teaser.**
  Added the same per-plan card pattern (per-plan CTA, "Recommended" badge on Pro) that already
  existed on the homepage — previously `/pricing` only had one generic "Create an account" link.
- **Missing analytics events (SRS §9.20).** Added `crawler_reference_page_opened` (fired from
  crawler-reference pages) and a `source` property on `audit_started`/`audit_completed`/
  `audit_failed` (forwarding each `AuditForm`'s `idPrefix`) so "Hero audit started" and "Final CTA
  audit started" can be distinguished from the same event stream, as the SRS requires.
- **Super Admin shell had no mobile/tablet navigation.** The desktop sidebar is `hidden lg:flex`
  with no replacement below 1024px. Added `AdminMobileNav.tsx` (same Drawer/IconButton pattern as
  the public site's `MobileNav`) wired into `AdminNav.astro`'s header.
- **A real WCAG 2.2 AA color-contrast violation**, found by the a11y coverage extension below:
  the admin sidebar's section headings used `text-neutral-500` (3.63:1) against the dark
  `neutral-950` background. Fixed to `text-neutral-300` (already used elsewhere in the same file
  against the same background).
- **Automated a11y/visual-regression coverage was public-site-only.** Added authenticated-route
  coverage: `/app` and `/admin` to `tests/a11y/home.spec.ts` (Chromium-only, real WebAuthn
  ceremony); `/app` (empty state) and `/admin/settings` to `tests/visual/core-pages.spec.ts` (14
  new baseline snapshots across all 7 breakpoints).

### Discovered, not fixed (out of scope for this pass — see `docs/status/KNOWN_RISKS.md`)

- The existing 91-snapshot visual-regression baseline is now confirmed stale against the current
  app: every one of the 13 pre-existing routes fails a fresh comparison, uniformly, by the exact
  height of the `PUBLIC_APP_ENV` environment banner added in Part 3 Step 26 — the baseline
  predates that banner and was never regenerated. Not regenerated in this pass since it's
  unrelated to any of the fixes above and out of this pass's scope.
- A pre-existing, unrelated a11y test failure on the `mobile-safari` Playwright project (the
  homepage's "skip link" keyboard-focus test) — a known Playwright/WebKit `Tab`-key limitation,
  confirmed unrelated to any file touched in this pass.

## Part 3 — Super Admin, Agency, SEO Launch, and Production Hardening (2026-07-24)

Super Admin Control Center (all 20 SRS §28 subsections), agency features, the full SRS §30.4 SEO
content minimum, accessibility/visual/performance hardening, operational runbooks, a real
privacy/retention bug fix, a real SRS traceability + security + production-readiness audit with
a genuine new e2e test suite, and production configuration preparation. See
`docs/status/IMPLEMENTATION_STATUS.md` for the detailed, maintained record — this entry is a
summary, not the source of truth.

### Added

- **Super Admin Control Center**: global dashboard (every §28.2 metric, date-range filters),
  user management (search/inspect/suspend/restore/revoke/delete with reason + audit log), full
  subscription/revenue/webhook administration (Paddle resync, temporary entitlements, webhook
  retry), global domain/scan operations (admin scans don't consume customer quota), scheduler
  health monitoring (missed/overlapping/stuck/long-execution/excessive-failure-rate detection),
  registry administration (crawler/operator CRUD, versioned release/publish/rollback/compare),
  findings analytics, security monitoring (suspend/block/revoke), content/notices, runtime
  configuration (validated safe ranges), maintenance mode, role model (6 roles defined, only
  `super_admin` assignable per the SRS's own stated MVP scope), and an audit log every sensitive
  action writes to automatically via one `requireAdminAction` chokepoint.
- **Agency features**: client groups, batch domain import with per-row error reporting, portfolio
  filters (group/monitoring/score/findings), client-safe share links with limited agency branding.
- **SEO content minimum (SRS §30.4), met and exceeded**: 20 crawler-reference pages (all
  source-verified against real operator documentation), 20 guides (10 decision/comparison + 5
  implementation + 5 troubleshooting), 5 free validator tools (`/tools/*`) that each genuinely
  lead with their own scoped section of a real scan rather than being relabelled duplicates,
  methodology/scoring/changelog pages, full technical SEO (canonical, Open Graph, structured
  data, sitemap, noindex rules) verified by a sitemap-driven Playwright test.
- **Accessibility, visual, and performance hardening**: skip-link/breadcrumb/focus-management
  fixes, a 91-snapshot visual-regression baseline (13 routes × 7 breakpoints), SQL-pushed admin
  list filtering with hard limit ceilings, 5 new database indexes.
- **Operational runbooks**: backup/recovery, incident response, system health, and the main
  runbook, all rewritten with real, verified admin routes and procedures.
- **A real, previously-undiscovered privacy/retention bug, found and fixed**: deleting a user
  account with any historical billing, scan, or admin-action row threw and aborted the entire
  daily data-retention cron job (14 actor-reference foreign key columns across `billing_customers`,
  `product_events`, `crawlers`, `registry_versions`, `ruleset_versions`, `admin_role_assignments`,
  `temporary_entitlements`, `scans`, `system_notices`, `security_events`, `admin_audit_logs`,
  `blocked_targets`, `runtime_configuration`, `internal_user_notes` all defaulted to `NO ACTION`
  instead of `SET NULL`). Fixed via migrations 0013–0015.
- **A real e2e test suite** (`auth-and-account.spec.ts`, `admin-flows.spec.ts`) using a real
  Chromium DevTools Protocol WebAuthn virtual authenticator — not a fabricated response — driving
  real passkey registration/sign-in, save-domain-and-scan, account deletion, report printing, and
  four Super Admin journeys end-to-end.
- **Three final audit reports**, each a real evidence-based pass, not a restatement of plans:
  `docs/status/FINAL_SRS_COMPLIANCE_REPORT.md`, `docs/status/FINAL_SECURITY_AUDIT.md`,
  `docs/status/FINAL_PRODUCTION_READINESS_REPORT.md`.
- **Production configuration fixes**: `env.preview` in `wrangler.jsonc` now has its own D1
  database binding and `PUBLIC_SITE_URL`/`WEBAUTHN_RP_ID`/`WEBAUTHN_RP_ORIGIN` (previously
  silently inherited production's or were missing entirely — the latter would have broken
  passkey auth outright on first production deploy); an SRS §10.43 environment indicator banner.
- Super Admin accounts now require keeping at least 2 registered passkeys (SRS §28.20) —
  `removeCredential` refuses to drop below that for an active admin account.

### Fixed

Issues found by actually running things, not by inspection:

- `PRAGMA foreign_keys=OFF` is silently a no-op inside a D1 migration file (D1 wraps it in one
  implicit transaction; SQLite ignores `foreign_keys` pragma changes mid-transaction) — the
  retention-fix migrations above originally shipped with it, passed against a fresh `sqlite3`
  CLI test, then failed against real D1. Fixed with `PRAGMA defer_foreign_keys=ON` instead.
- `db:validate`'s static parser false-positived on the SQLite table-rebuild pattern's intermediate
  `_new` tables.
- A real SSR crash in the customer dashboard's Overview page for any brand-new, zero-domain
  account (`EmptyState`'s `action` prop received Astro template syntax instead of a real React
  element; the dev server silently returned `200` with an empty body instead of a 500) — found by
  the new e2e suite, since it was the first thing in the project's history to render that page
  for a genuinely empty account through a real browser.
- Two stale claims in `docs/security/SECURITY_CHECKLIST.md` (administrative audit logs marked
  "schema only" when fully built; production/preview separation marked done when it wasn't).
- Registry publication workflow's traceability row incorrectly still said "Part 3" after Part 3
  built it.

### Known gaps (see `docs/status/KNOWN_RISKS.md`)

Paddle field-shapes still unverified against a live sandbox account (the single most important
remaining item before production launch); visual-regression baseline still not wired into CI
(platform-suffix mismatch); e2e coverage against SRS §35.3's full journey list is real but not
exhaustive (scheduled scan, Paddle purchase/portal, agency report have no dedicated e2e test yet);
`env.preview`'s domain-specific values are structurally correct but still placeholders pending a
real preview domain; no cross-request target-frequency abuse monitoring. **This repository still
has zero git commits.**

## Part 2 — Customer-Facing SaaS (2026-07-23)

Complete customer-facing product: live scanner, robots.txt engine, crawler registry, policy
evaluation, findings/scoring, recommendations, full report pipeline, passkey authentication,
saved domains, customer dashboard, scheduled monitoring, notifications, Paddle billing, and
first-party analytics. See `docs/status/IMPLEMENTATION_STATUS.md` for the detailed, maintained
record — this entry is a summary, not the source of truth.

### Added

- `packages/scanner`: safe-fetch chokepoint with full timeout/redirect/size/request-count
  enforcement; `packages/robots`: RFC 9309 parser + evaluator; `packages/registry`: versioned
  crawler registry (13 crawlers, 8 operators); `packages/policy`: presets, additional-signal
  parsers (llms.txt, RSL, Content Signals, HTML/HTTP, sitemap), conflict detection, findings,
  Policy Health Score, deterministic recommendations.
- `POST /api/audit` now runs a real, bounded scan end-to-end when `AUDIT_ENGINE_ENABLED=true` —
  still returns the honest `AUDIT_ENGINE_DISABLED` error, never a fabricated result, when `false`.
- Passkey-only (WebAuthn) authentication: registration, login, credential management, DB-backed
  revocable sessions, hashed one-time recovery codes, step-up auth for sensitive actions.
- Saved domains, domain groups, ownership-scoped everywhere; customer dashboard (`/app/*`).
- Scheduled monitoring sweep with drift detection and failure backoff/pause; notification centre
  with a private, revocable Atom feed.
- Paddle Billing v2 integration: checkout, customer portal, signature-verified/idempotent webhook
  processing with out-of-order protection — not verified against a live sandbox account.
- First-party, cookie-free analytics and shared-report tokens.
- Security/privacy hardening: CSP + full security headers on every SSR response, CSRF defence
  (SameSite + Origin/Referer check), anonymous-audit rate limiting, target blocklist enforcement,
  CSV formula-injection prevention, daily data-retention purge job, IP hashing.
- 252 unit/integration tests (28 files) against a real Miniflare-backed D1 database; 8 e2e tests,
  16 accessibility tests, and a new 42-snapshot visual-regression baseline (6 pages × 7
  breakpoints) — all run and passing this Part.
- 51 real public domains audited respectfully (sequential, 3s gap, no parallelism) as a real-world
  correctness check — see `docs/status/PART2_REAL_DOMAIN_TEST_RESULTS.md`.

### Fixed

Issues found by actually running the quality gate and the real-domain test, not by inspection:

- **Total-scan timeout (FR-FET-007) was missing** — only a per-resource timeout existed, so a
  slow target's 5 sequential resource fetches could compound to ~5× the per-resource timeout
  (confirmed: `npr.org` took 104s). Added an enforced, configurable total-scan budget (default
  30s); the same domain now completes in 30.5s.
- `persist-scan.ts` primary-key collision when a robots.txt fetch was fully refused.
- CSRF rollout required fixing ~15 existing integration tests' missing `Origin` headers.
- One e2e test bug (missing hydration wait on the mobile nav test, same class of race already
  documented for the audit form).

### Known gaps (see `docs/status/KNOWN_RISKS.md`)

Paddle field-shapes unverified against a live sandbox account; visual-regression baseline not
wired into CI (platform-suffix mismatch between local macOS generation and Linux CI); no
cross-request target-frequency abuse monitoring; billing records have no retention/purge job;
Super Admin and agency-feature polish are Part 3 scope. **This repository has zero git commits —
all Part 1 and Part 2 work exists only in the working tree.**

## Part 1 — Engineering Foundation (2026-07-22)

Initial repository build-out. See `docs/status/IMPLEMENTATION_STATUS.md` for the detailed,
maintained record — this entry is a summary, not the source of truth.

### Added

- pnpm workspace monorepo: `apps/web` (Astro on Cloudflare Workers) + `packages/{core,scanner,
registry,database,ui,config}`.
- Architecture Decision Records ADR-0001 through ADR-0005.
- Full documentation tree under `docs/` (architecture, design, api, data, security, testing,
  operations, deployment, seo, registry, status, release).
- D1 schema: 8 migrations, 38 tables, matching Drizzle schema mirror, `db:validate` drift check.
- Local dev seed: subscription plans, a non-production Super Admin fixture, an 8-operator /
  13-crawler development crawler registry.
- Design system: tokens (`packages/ui/src/tokens/tokens.css`) and 36 accessible components
  (Radix UI + Tailwind CSS v4).
- Public website: landing page (all 15 required sections), crawler directory, guides, free
  tools index + 5 validator pages, pricing, methodology, scoring, scanner info, changelog,
  status, security, privacy, terms, acceptable-use, limitations, sign-in placeholder.
- `POST /api/audit`: validates and normalises input, returns `AUDIT_ENGINE_DISABLED` honestly —
  never a fabricated result.
- Typed API contracts for audit, auth, domains, groups, notifications, billing, sharing, admin.
- CI workflow: format, lint, typecheck, unit + integration tests, migration validation,
  dependency audit, secret scanning, build, e2e + accessibility smoke tests.
- Agent governance: `CLAUDE.md`, `AGENTS.md`, nested `AGENTS.md` for `packages/scanner`,
  `packages/database`, `apps/web/src/pages/api`; `.claude/settings.json`; three repo-local
  skills (`quality-gate`, `security-review`, `release-audit`).

### Fixed

Issues found by actually running the quality gate (format, lint, typecheck, unit/integration
tests, D1 migrations + seed against a local database, e2e, and axe-core accessibility scans),
not by inspection — see `docs/status/KNOWN_RISKS.md` for full detail:

- `Astro.locals.runtime.env` access, removed in Astro v6+/`@astrojs/cloudflare` 14.x; moved to
  `import { env } from "cloudflare:workers"` via a dedicated `apps/web/src/lib/env.ts`.
- Legacy `src/content/config.ts` location and collection API; migrated to `src/content.config.ts`
  with the `glob()` loader.
- Two design tokens (`--color-warning`, `--color-neutral-500`) failing WCAG AA 4.5:1 contrast.
- Inline prose links relying on hover-only underline, failing axe's `link-in-text-block` check.
- A horizontally-scrollable table not reachable by keyboard (WCAG 2.1.1).

### Known gaps (see `docs/status/KNOWN_RISKS.md`)

Scanner, authentication, monitoring, billing, and Super Admin are not implemented. SEO content
minimum (SRS §30.4) is not yet reached. No visual-regression baseline exists yet. Content
Security Policy is not yet configured.
