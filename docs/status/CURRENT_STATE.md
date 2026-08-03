---
Document owner: Engineering owner
Status: current-authoritative
Last verified: 2026-08-03
Repository commit: 1a39d29ddaed9a9c4b95c8a3630b1babe023fd79 (main, post-Phase-0-merge)
Production deployment identifier: crawlpact-web (Cloudflare Worker), https://crawlpact.com
Database migration version: 0018_incidents.sql (18/18 applied, production and preview, zero drift)
Crawler registry version: 2026.07.3 (active release; 23 crawlers seeded, correction pending publication as a new release — see docs/registry/CRAWLER_REGISTRY_GOVERNANCE.md)
Phase 0 baseline reference: docs/baseline/2026-08-03/
Review frequency: Every release, or monthly
Next review date: 2026-09-03 (or sooner, at the next release)
---

# Current State

**This is the single, shortest authoritative description of what is currently true about
CrawlPact.** It does not replace production evidence — see `docs/baseline/2026-08-03/` for the
full evidence chain behind every claim below. When this document and a historical or requirements
document disagree, this document (or a fresher production check) wins.

## Executive status

CrawlPact is live in production at `https://crawlpact.com` on Cloudflare Workers. The anonymous
audit engine, authentication (passkey/WebAuthn), scheduled monitoring, Paddle billing, the crawler
registry, Super Admin Control Center, and public status/incident tracking are all built; most are
`verified-live` in production, the rest are `code-present-not-production-verified` (built and
tested, but without a specific dated production-behavior check — see the capability table below).
**Production and the default branch (`main`) are aligned** — no known drift.

Major limitations: a real **paid** Paddle checkout lifecycle has never been run (webhook
processing itself is verified live); the Workers Free CPU budget constrains monitoring-sweep
scale below the SRS's own commercial target (accepted tradeoff at current near-zero volume); no
legal entity/jurisdiction/contact is published (explicitly deferred by the product owner); Google
Analytics runs on public marketing pages only, a disclosed deviation from SRS §6.2. Full detail:
`docs/risks/ACTIVE_RISKS.md`.

## Capability table

Status vocabulary: `verified-live` · `verified-disabled` · `verified-partial` ·
`code-present-not-production-verified` · `documented-only` · `historical-only` · `unknown` ·
`verification-blocked`. Full evidence for every row: `docs/baseline/2026-08-03/CAPABILITY_MATRIX.md`.

| Capability                        | Status                                                    | Production evidence                                            | Code evidence                                   | Test evidence                                                        | Dependency                          | Known limitation                                                                 |
| --------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| Anonymous audit                   | `verified-live`                                           | Real scans confirmed in production                             | `api/audit/index.ts`, `packages/scanner`        | `audit-api.integration.test.ts`                                      | `AUDIT_ENGINE_ENABLED=true`         | Workers Free CPU budget is thin at scale (`docs/risks/ACTIVE_RISKS.md` RISK-008) |
| Public report                     | `verified-live` (pattern)                                 | Live per audit-engine flag                                     | `pages/audit/[auditId].astro`                   | Indirect                                                             | Same flag                           | Report ID is the sole access control (deliberate)                                |
| Authentication (passkey/WebAuthn) | `verified-live`                                           | Real register→sign-out→sign-in round trip confirmed 2026-07-28 | `lib/auth/*`                                    | `auth-flow.integration.test.ts`, e2e                                 | Passkey-only, no password fallback  | —                                                                                |
| Saved domains / monitoring        | `code-present-not-production-verified`                    | Cron config live; execution history not queried                | `lib/domains.ts`, `lib/monitoring.ts`           | `domains-flow.integration.test.ts`, `monitoring.integration.test.ts` | `AUDIT_ENGINE_ENABLED`              | CPU-budget risk at scale — RISK-008                                              |
| Notifications / Atom feed         | `code-present-not-production-verified`                    | Not queried                                                    | `lib/notifications.ts`                          | `notifications-flow.integration.test.ts`                             | Plan-gated                          | Atom feed route has no dedicated test file by name — RISK-024                    |
| Billing (checkout)                | `verified-partial`                                        | Price IDs confirmed live; no paid checkout run                 | `api/billing/checkout.ts`                       | None found by name                                                   | Paddle config                       | RISK-001                                                                         |
| Billing (webhooks)                | `verified-live`                                           | 8 real Paddle-signed events processed 2026-07-28               | `api/billing/webhook.ts`                        | `billing-webhook.integration.test.ts`                                | Paddle notification destination     | —                                                                                |
| Agency features                   | `code-present-not-production-verified`                    | Not queried                                                    | `lib/groups.ts`, `lib/agency-logo.ts`           | `agency-features.integration.test.ts`                                | Agency plan                         | R2 logo orphan cleanup gap — RISK-010                                            |
| Crawler registry                  | `code-present-not-production-verified`                    | Seed gap found+fixed live 2026-07-28                           | `lib/registry-data.ts`, `lib/admin/registry.ts` | `admin-registry.integration.test.ts`                                 | —                                   | 22/23 crawlers have a public page (Bingbot excluded)                             |
| Super Admin Control Center        | `code-present-not-production-verified`                    | No production admin-session evidence cited                     | `lib/admin/*`, ~27 admin pages                  | 20+ `admin-*.integration.test.ts`                                    | Passkey-only, 2-passkey minimum     | Only `super_admin` role assignable (matches SRS MVP scope)                       |
| Public status / incidents         | `verified-live`                                           | Live env reads confirmed                                       | `pages/status.astro`, `lib/admin/incidents.ts`  | `admin-incidents.integration.test.ts`                                | —                                   | No SRS requirement backs this feature (disclosed, not a gap)                     |
| Analytics (first-party)           | `code-present-not-production-verified`                    | Not queried                                                    | `lib/analytics.ts`                              | Incidental only                                                      | —                                   | No dedicated Super Admin dashboard for the 14 SRS §28.13 metrics yet             |
| Analytics (Google Analytics)      | `verified-live`                                           | CSP allow-list confirmed live                                  | `components/GoogleAnalytics.astro`              | None                                                                 | `MarketingLayout` + production-only | Disclosed SRS §6.2 deviation; no cookie-consent mechanism (RISK-021)             |
| Security/trust/legal pages        | `code-present-not-production-verified` to `verified-live` | Varies by route                                                | Various                                         | `seo-metadata.spec.ts`                                               | —                                   | No `security.txt` served (RISK from Phase 0)                                     |

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

- **Application commit**: `1a39d29` (main, post-Phase-0-merge)
- **Migration version**: 18/18 applied (`0018_incidents.sql` latest), zero drift between local,
  preview, and production
- **Registry version**: `2026.07.3` active (23 crawlers seeded; a correction adding two Amazon
  crawlers is pending publication as a new release — see
  `docs/registry/CRAWLER_REGISTRY_GOVERNANCE.md`)
- **Billing configuration**: live Paddle catalog (Solo $79/Pro $179/Agency $399, annual-only),
  confirmed matching code 2026-08-03; webhook destination active
- **Public content verification date**: 2026-07-31 (content/trust/SEO pass) — see
  `docs/reports/CRAWLPACT_PRODUCTION_CONTENT_TRUST_SEO_COMPLETION_REPORT.md` (historical)

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

## Verification limitations

- Cron trigger _execution_ history (as opposed to configuration) has not been queried.
- Zone-level DNS/SSL/WAF/cache-rule configuration cannot be read via the current Cloudflare API
  credential scope — needs manual dashboard verification or a broader-scoped token.
- Production Worker secret _presence_ (not values) was not re-verified in Phase 0/1 — secret
  values are never API-readable by design.
- E2E, accessibility, and Lighthouse suites were not re-run during Phase 0/1 (no UI/behavior
  change occurred in either phase).
- A 40-vs-39 table-count discrepancy between local `db:validate` and a live production count is
  unresolved (RISK-019).

## Evidence links

- Phase 0 baseline: `docs/baseline/2026-08-03/PHASE_0_BASELINE_REPORT.md`
- Production deployment record: `docs/deployment/DEPLOYMENT.md`
- Test evidence: `docs/baseline/2026-08-03/TEST_AND_CI_EVIDENCE.md`
- Current risk register: `docs/risks/ACTIVE_RISKS.md`
- Changelog: `CHANGELOG.md`
- Requirements traceability: `docs/status/REQUIREMENTS_TRACEABILITY.md`
