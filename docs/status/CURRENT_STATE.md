---
Document owner: Engineering owner
Status: current-authoritative
Last verified: 2026-08-07
Repository commit: 3ee3b2f0bd25ff050b7f592e0b057a1b2db7c144 (main, post-Phase-9 merge, deployed)
Production deployment identifier: crawlpact-web (Cloudflare Worker), https://crawlpact.com — Worker version 7ce60f6d-5ed9-4cf2-b9ff-a2b5ac31e44c
Database migration version: 0029_agency_workspace_portfolio.sql (29/29 applied to production, confirmed via `wrangler d1 migrations list --remote` reporting "No migrations to apply!" and direct `sqlite_master` queries 2026-08-07 — `agency_brand_profiles`, `portfolio_import_jobs`, `portfolio_import_rows`, `bulk_action_jobs` tables and the `domain_groups.description` column all independently verified present)
Crawler registry version: 2026.07.3 (active release; 23 crawlers seeded, correction pending publication as a new release — see docs/registry/CRAWLER_REGISTRY_GOVERNANCE.md)
Phase 0 baseline reference: docs/baseline/2026-08-03/ (superseded on billing/migration facts by Phases 5–6 below; not re-run this pass)
Review frequency: Every release, or monthly
Next review date: 2026-09-07 (or sooner, at the next release)
---

# Current State

**This is the single, shortest authoritative description of what is currently true about
CrawlPact.** It does not replace production evidence — see `docs/baseline/2026-08-03/` for the
full evidence chain behind every claim below. When this document and a historical or requirements
document disagree, this document (or a fresher production check) wins.

## Executive status

CrawlPact is live in production at `https://crawlpact.com` on Cloudflare Workers. The anonymous
audit engine, authentication (passkey/WebAuthn), scheduled monitoring, Paddle billing (DB-backed
catalog, Phase 6), anonymous-audit-to-account conversion (Phase 5), the crawler registry, Super
Admin Control Center, and public status/incident tracking are all built; most are `verified-live`
in production, the rest are `code-present-not-production-verified` (built and tested, but without
a specific dated production-behavior check — see the capability table below). As of this pass,
the public marketing site also includes Phase 7 (Vertical Landing Pages and Platform SEO
Architecture): 4 audience-specific landing pages (`/for/*`) and a platform-guide hub plus 5
verified platform guides (`/platforms/*`) — content-only, no product-behavior change. Deployed to
production 2026-08-04, Worker version `630258b4-c020-4105-9ca3-550897f7c0e3`; all 10 new routes
independently confirmed live (see the Phase 7 completion report).
**Production and the default branch (`main`) are aligned** — no known drift as of the last
deployed commit (`3ee3b2f`).

Major limitations: a real **paid** Paddle checkout lifecycle has never been run (webhook
processing itself is verified live — RISK-001, still open); the Workers Free CPU budget constrains
monitoring-sweep scale below the SRS's own commercial target (accepted tradeoff at current
near-zero volume); no legal entity/jurisdiction/contact is published (explicitly deferred by the
product owner); Google Analytics runs on public marketing pages only, a disclosed deviation from
SRS §6.2 (the product owner has since confirmed keeping GA — see
`docs/risks/ACTIVE_RISKS.md` RISK-021). Full detail: `docs/risks/ACTIVE_RISKS.md`.

**Phase 11 (Database, Storage, Retention and Performance Hardening) status**: merged and deployed
to production 2026-08-05, Worker version `7d1b4cc4-2232-4c21-9f91-5b154f94e5c2` (PR #86, plus a
same-day test-timeout fix PR #87). Closes RISK-005/RISK-009 (both independently re-verified live —
`scan_diffs`/`audit_continuations` FKs now show the corrected `ON DELETE` behavior via a real
production `PRAGMA foreign_key_list` query), mitigates RISK-007, re-models RISK-008 (unchanged
conclusion: accepted tradeoff at current volume), assesses RISK-006 (recommendation recorded, not
implemented pending approval), and finds RISK-033's production performance gap already closed via
real re-measurement. The new public-cache opt-ins (`/for/*`, `/scanner`, `/changelog`) and the
deny-by-default `private, no-store` default were independently re-verified live via direct `curl`
against production. See `docs/reports/PHASE_11_DATABASE_STORAGE_PERFORMANCE_COMPLETION_REPORT.md`
and `CHANGELOG.md`'s 2026-08-05 entry for full deployment evidence, including a disclosed,
pre-existing, unrelated preview-environment secrets gap found (not caused) during this deploy.

**Public Status and Changelog Trust Correction status**: merged and deployed to production
2026-08-06, Worker version `da3ee995-b18b-4b14-b169-735b2a1859b8` (PR #89). Found and fixed a real,
live production bug in the process: `/status` had been showing "Degraded performance" for the
overall status and "Billing and checkout" — caused by an all-time, no-time-window count of stale
webhook-processing failures with zero real recent impact, confirmed via production D1 and Paddle's
own delivery log before the fix, and independently confirmed live via direct `curl` after
deployment (both now show "Operational"). Removed the trust-reducing uptime-absence sentence and a
dead link to the (already correctly archived, since Phase 1) `IMPLEMENTATION_STATUS.md` doc. See
`docs/reports/PUBLIC_STATUS_AND_CHANGELOG_TRUST_CORRECTION_REPORT.md` and `CHANGELOG.md`'s
2026-08-06 entry for full deployment evidence.

**Phase 8 (Saved-Domain Experience and Change Timeline) status**: merged and deployed to
production 2026-08-06, Worker version `629c546c-ba30-4147-af6f-b750e5c051b2` (PR #91, plus a
same-PR CI-only bug fix before merge). Adds a deterministic change-attribution model, a
materialised policy-change timeline (`domain_change_events`, migration `0026`), a before/after
scan-comparison view, and finding-lifecycle classification (`findings.fingerprint`, migration
`0027`). Found and fixed two real, previously-unguarded gaps: no duplicate-simultaneous-scan
prevention on manual rescans (`domains.scan_lock_until`, migration `0028`), and a hardcoded
`monitoring: "Not enabled"` bug in the reused policy-summary function. All three migrations and
the redesigned saved-domain routes independently re-verified live (direct production D1 queries
confirming the new table/columns; direct `curl` checks confirming the new/redesigned routes
correctly require authentication). See
`docs/reports/PHASE_08_SAVED_DOMAIN_CHANGE_TIMELINE_COMPLETION_REPORT.md` and `CHANGELOG.md`'s
2026-08-06 Phase 8 entry for full deployment evidence.

**Phase 9 (Agency Workspace and Portfolio Workflows) status**: merged and deployed to production
2026-08-07, Worker version `7ce60f6d-5ed9-4cf2-b9ff-a2b5ac31e44c` (PR #93). Adds an authenticated
agency/portfolio workspace (`/app/workspace`), an explainable portfolio summary and attention
queue built from Phase 8's `domain_change_events`, an account-wide cursor-paginated change feed,
safe non-empty domain-group deletion, a server-side-paginated portfolio table, a genuine CSV file
batch-import workflow, an extended CSV export, bounded bulk actions, a persistent Agency-branding
profile, and real saved views. Closed RISK-010 (R2 agency-logo orphan cleanup) via a new category
in the existing daily retention cron. One additive migration (`0029`, 29/29 applied). Found and
fixed two real defects during this phase's own testing: a D1 bound-parameter limit that would
have broken any CSV import over ~14 rows (fixed by chunking the insert), and a pre-existing
accessibility defect (an unlabelled group-rename input, present before this phase) caught by a new
a11y scan. Team roles, a client portal, bulk rescan, a multi-domain portfolio-report product, and
cross-domain comparison were evaluated against the SRS and explicitly not implemented — see the
six `docs/product/PHASE_09_*_DECISION.md` documents. All new routes and the migration
independently re-verified live (direct production D1 queries confirming the four new tables and
the `domain_groups.description` column; direct `curl` checks confirming every new route requires
authentication and carries `private, no-store` + `noindex, nofollow, noarchive`). See
`docs/reports/PHASE_09_AGENCY_WORKSPACE_PORTFOLIO_COMPLETION_REPORT.md` and `CHANGELOG.md`'s
2026-08-07 Phase 9 entry for full deployment evidence.

## Capability table

Status vocabulary: `verified-live` · `verified-disabled` · `verified-partial` ·
`code-present-not-production-verified` · `documented-only` · `historical-only` · `unknown` ·
`verification-blocked`. Full evidence for every row: `docs/baseline/2026-08-03/CAPABILITY_MATRIX.md`.

| Capability                        | Status                                                    | Production evidence                                                                                                                 | Code evidence                                                                                               | Test evidence                                                                                                       | Dependency                          | Known limitation                                                                 |
| --------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| Anonymous audit                   | `verified-live`                                           | Real scans confirmed in production                                                                                                  | `api/audit/index.ts`, `packages/scanner`                                                                    | `audit-api.integration.test.ts`                                                                                     | `AUDIT_ENGINE_ENABLED=true`         | Workers Free CPU budget is thin at scale (`docs/risks/ACTIVE_RISKS.md` RISK-008) |
| Public report                     | `verified-live` (pattern)                                 | Live per audit-engine flag                                                                                                          | `pages/audit/[auditId].astro`                                                                               | Indirect                                                                                                            | Same flag                           | Report ID is the sole access control (deliberate)                                |
| Authentication (passkey/WebAuthn) | `verified-live`                                           | Real register→sign-out→sign-in round trip confirmed 2026-07-28                                                                      | `lib/auth/*`                                                                                                | `auth-flow.integration.test.ts`, e2e                                                                                | Passkey-only, no password fallback  | —                                                                                |
| Saved domains / monitoring        | `code-present-not-production-verified`                    | Cron config live; execution history not queried                                                                                     | `lib/domains.ts`, `lib/monitoring.ts`                                                                       | `domains-flow.integration.test.ts`, `monitoring.integration.test.ts`                                                | `AUDIT_ENGINE_ENABLED`              | CPU-budget risk at scale — RISK-008                                              |
| Notifications / Atom feed         | `code-present-not-production-verified`                    | Not queried                                                                                                                         | `lib/notifications.ts`                                                                                      | `notifications-flow.integration.test.ts`                                                                            | Plan-gated                          | Atom feed route has no dedicated test file by name — RISK-024                    |
| Billing (checkout)                | `verified-partial`                                        | Price IDs confirmed live; no paid checkout run                                                                                      | `api/billing/checkout.ts`                                                                                   | None found by name                                                                                                  | Paddle config                       | RISK-001                                                                         |
| Billing (webhooks)                | `verified-live`                                           | 8 real Paddle-signed events processed 2026-07-28                                                                                    | `api/billing/webhook.ts`                                                                                    | `billing-webhook.integration.test.ts`                                                                               | Paddle notification destination     | —                                                                                |
| Agency features                   | `verified-live`                                           | All Phase 9 routes independently confirmed live 2026-08-07 (auth-required, private/noindex); migration verified via direct D1 query | `lib/groups.ts`, `lib/agency-logo.ts`, `lib/portfolio.ts`, `lib/portfolio-import.ts`, `lib/bulk-actions.ts` | `agency-features.integration.test.ts`, `agency-workspace-portfolio.integration.test.ts`, `agency-workspace.spec.ts` | Agency plan                         | RISK-010 closed (Phase 9, ARC-027)                                               |
| Crawler registry                  | `code-present-not-production-verified`                    | Seed gap found+fixed live 2026-07-28                                                                                                | `lib/registry-data.ts`, `lib/admin/registry.ts`                                                             | `admin-registry.integration.test.ts`                                                                                | —                                   | 22/23 crawlers have a public page (Bingbot excluded)                             |
| Super Admin Control Center        | `code-present-not-production-verified`                    | No production admin-session evidence cited                                                                                          | `lib/admin/*`, ~27 admin pages                                                                              | 20+ `admin-*.integration.test.ts`                                                                                   | Passkey-only, 2-passkey minimum     | Only `super_admin` role assignable (matches SRS MVP scope)                       |
| Public status / incidents         | `verified-live`                                           | Live env reads confirmed                                                                                                            | `pages/status.astro`, `lib/admin/incidents.ts`                                                              | `admin-incidents.integration.test.ts`                                                                               | —                                   | No SRS requirement backs this feature (disclosed, not a gap)                     |
| Analytics (first-party)           | `code-present-not-production-verified`                    | Not queried                                                                                                                         | `lib/analytics.ts`                                                                                          | Incidental only                                                                                                     | —                                   | No dedicated Super Admin dashboard for the 14 SRS §28.13 metrics yet             |
| Analytics (Google Analytics)      | `verified-live`                                           | CSP allow-list confirmed live                                                                                                       | `components/GoogleAnalytics.astro`                                                                          | None                                                                                                                | `MarketingLayout` + production-only | Disclosed SRS §6.2 deviation; no cookie-consent mechanism (RISK-021)             |
| Security/trust/legal pages        | `code-present-not-production-verified` to `verified-live` | Varies by route                                                                                                                     | Various                                                                                                     | `seo-metadata.spec.ts`                                                                                              | —                                   | No `security.txt` served (RISK from Phase 0)                                     |
| Vertical landing pages (Phase 7)  | `verified-live`                                           | All 4 `/for/*` routes return HTTP 200 in production, confirmed 2026-08-04                                                           | `pages/for/[slug].astro`, `content/verticals/*`                                                             | `seo-metadata.spec.ts`, `home.spec.ts` (a11y), `responsive-smoke.spec.ts`                                           | Live pricing via `getPlanCatalog()` | 4/4 built (agencies, publishers, SaaS/documentation, web developers)             |
| Platform guides (Phase 7)         | `verified-live`                                           | `/platforms` hub + all 5 `/platforms/*` guides return HTTP 200 in production, confirmed 2026-08-04                                  | `pages/platforms/[slug].astro`, `content/platforms/*`                                                       | Same as above                                                                                                       | —                                   | 5/5 priority guides built; 5 extended guides deferred (Stage 7D)                 |

## Environment status

- **Local**: `pnpm dev`, D1/KV emulated locally via Wrangler, all Paddle values placeholder.
- **Preview**: `crawlpact-web-preview` Worker, separate D1/KV/R2, sandbox Paddle values,
  `AUDIT_ENGINE_ENABLED=false`. Preview's GitHub Actions deploy currently blocked on a
  secret-naming mismatch — see `docs/risks/ACTIVE_RISKS.md` RISK-014.
- **Production**: `crawlpact-web` Worker at `https://crawlpact.com`, real D1/KV/R2, real Paddle
  catalog, `AUDIT_ENGINE_ENABLED=true`, `BILLING_ENABLED=true`. No secret values are recorded
  here — see `docs/baseline/2026-08-03/ENVIRONMENT_AND_BINDING_INVENTORY.md` for names/purposes
  only.

## Version status

- **Application commit**: `4637e1a` (main, post-Phase-7-merge)
- **Migration version**: 21/21 applied (`0021_plan_prices.sql` latest), zero drift between local,
  preview, and production
- **Registry version**: `2026.07.3` active (23 crawlers seeded; a correction adding two Amazon
  crawlers is pending publication as a new release — see
  `docs/registry/CRAWLER_REGISTRY_GOVERNANCE.md`)
- **Billing configuration**: live, DB-backed Paddle catalog (Phase 6) — Solo $9/mo or $89/yr, Pro
  $19/mo or $189/yr, Agency $39/mo or $389/yr — see
  `docs/billing/APPROVED_PRICING_AND_ENTITLEMENT_MATRIX.md`; deployed to production as Worker
  version `7ed25286-f394-4517-aca6-5fe5168b41a4`
- **Public content verification date**: 2026-07-31 (content/trust/SEO pass) — see
  `docs/reports/CRAWLPACT_PRODUCTION_CONTENT_TRUST_SEO_COMPLETION_REPORT.md` (historical);
  re-checked 2026-08-04 for Phase 7's new `/for/*`/`/platforms/*` content via `pnpm trust:validate`
  (395 files scanned, passed)

## Open P0 and P1 risks

See `docs/risks/ACTIVE_RISKS.md` for full detail (not duplicated here). Summary: **0 open P0
risks.** Open P1 risks: real paid Paddle checkout lifecycle never run (RISK-001); Paddle webhook
secret exposed in plaintext once, not rotated (RISK-002); `scan_diffs` missing `ON DELETE` clause
(RISK-005); `scan_resources.snapshot_text` full-HTML capture drives D1 storage growth (RISK-007);
Workers Free CPU budget risk at commercial scale (RISK-008); no legal entity/jurisdiction/contact
published (RISK-011, explicitly deferred); `reference-data.sql` registry-immutability risk on
re-run (RISK-018); no cookie-consent mechanism for the GA deviation (RISK-021).

## Known disabled or incomplete capabilities

- Real paid Paddle checkout lifecycle: never run (deliberately, requires separate authorization).
- Super Admin 14-metric usage-analytics dashboard (SRS §28.13): individual events recorded, not
  yet aggregated into a distinct admin view.
- Built-server E2E (real `wrangler dev --local` against the built Worker): reverted twice after
  real-CI-only crashes; e2e/a11y currently run against `astro dev` instead.
- Preview environment GitHub Actions deploy: blocked on a secret-naming mismatch (RISK-014).
- Bingbot has a registry row but no public crawler-directory page (its official source is
  JS-rendered and could not be fetched/read) — deliberate, disclosed exception.
- Phase 7 extended platform guides (nginx, apache, fastly, akamai, GitHub Pages): deliberately
  deferred — the priority-5 platform guides met the required official-source research bar, the
  extended 5 were not attempted this phase (see the Phase 7 completion report's "Deferred work"
  section and `docs/seo/SEO_CONTENT_GOVERNANCE.md`).

## Verification limitations

- Cron trigger _execution_ history (as opposed to configuration) has not been queried.
- Zone-level DNS/SSL/WAF/cache-rule configuration cannot be read via the current Cloudflare API
  credential scope — needs manual dashboard verification or a broader-scoped token.
- Production Worker secret _presence_ (not values) was not re-verified in Phase 0/1 — secret
  values are never API-readable by design.
- E2E, accessibility, and Lighthouse suites were not re-run during Phase 0/1 (no UI/behavior
  change occurred in either phase).
- A 40-vs-39 table-count discrepancy between local `db:validate` and a live production count —
  **resolved by Phase 11**: re-measured production table list (42, via `sqlite_master`) against a
  fresh extraction of every `sqliteTable(...)` in the Drizzle schema (also 42) — exact match, name
  for name. No longer reproduces against the current schema/production state (RISK-019).

## Evidence links

- Phase 0 baseline: `docs/baseline/2026-08-03/PHASE_0_BASELINE_REPORT.md`
- Production deployment record: `docs/deployment/DEPLOYMENT.md`
- Test evidence: `docs/baseline/2026-08-03/TEST_AND_CI_EVIDENCE.md`
- Phase 6 completion report: `docs/reports/PHASE_06_PRICING_PADDLE_CHECKOUT_COMPLETION_REPORT.md`
- Phase 7 completion report: `docs/reports/PHASE_07_VERTICAL_PLATFORM_SEO_COMPLETION_REPORT.md`
- Phase 8 completion report: `docs/reports/PHASE_08_SAVED_DOMAIN_CHANGE_TIMELINE_COMPLETION_REPORT.md`
- Phase 9 completion report: `docs/reports/PHASE_09_AGENCY_WORKSPACE_PORTFOLIO_COMPLETION_REPORT.md`
- Phase 11 completion report: `docs/reports/PHASE_11_DATABASE_STORAGE_PERFORMANCE_COMPLETION_REPORT.md`
- Current risk register: `docs/risks/ACTIVE_RISKS.md`
- Changelog: `CHANGELOG.md`
- Requirements traceability: `docs/status/REQUIREMENTS_TRACEABILITY.md`
