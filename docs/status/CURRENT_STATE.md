---
Document owner: Engineering owner
Status: current-authoritative
Last verified: 2026-08-18
Repository commit: e72d7242d08ffdfbbb028f62b8379b7f9cbb6d4b (main, post-Phase-19-pricing-comparison-deploy)
Production deployment identifier: crawlpact-web (Cloudflare Worker), https://crawlpact.com — Worker version 9efd4c33-9b64-4959-94f8-2f79a7d50294
Database migration version: 0037_registry_token_case_insensitive_uniqueness.sql (37/37 applied to production, confirmed via a direct read-only D1 query against `d1_migrations` 2026-08-17)
Crawler registry version: 2026.07.3 (active release, unchanged by Phase 17's deploy — the Amazon/Google/Bingbot corrections are independently re-verified and ready in `packages/database/seed/reference-data.sql`, still awaiting a real Super Admin session to publish; see docs/registry/CRAWLER_REGISTRY_GOVERNANCE.md and the Phase 15 completion report)
Phase 0 baseline reference: docs/baseline/2026-08-03/ (superseded on billing/migration facts by Phases 5–6 below; not re-run this pass)
Review frequency: Every release, or monthly
Next review date: 2026-09-13 (or sooner, at the next release)
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
deployed commit (`16fb160`).

A final Phase 0–18 reconfirmation and brand-consistency pass (2026-08-14, commit `16fb160`, Worker
`280cac36-d3cb-4ca0-a7a2-03aab2c6ecf8`) re-verified every Phase 0–18 guarantee against the actual
current product rather than reusing prior evidence, and found and fixed one real defect: the
shared `AuditReportView.tsx` (used by `/audit/[auditId]`, `/sample-report`, `/shared/[token]`, and
the domain workspace) still inlined the historical pre-rebrand C-bracket logo SVG instead of the
current shield/checkmark mark. Fixed via a new shared `BrandMark.tsx` React component, with
`brand:validate` permanently strengthened against regression and new unit/E2E test coverage.
Pricing was independently re-verified live (D1 catalog, live Paddle, and 8 public routes all
match, 0 legacy prices leaking). Full quality gate re-run clean (unit 408, integration 350,
security 41, E2E 246, accessibility 196/197 with only the pre-existing accepted RISK-013). See
`docs/release/PHASE_00_18_RECONFIRMATION_MATRIX.md` and
`docs/reports/PHASE_00_18_FINAL_RECONFIRMATION_AND_PRODUCTION_RELEASE.md`.

Phase 17 (Customer Pilot and Commercial Validation, deployed 2026-08-13) added the **technical
readiness** infrastructure for a real customer pilot: `pilot_cohorts`/`pilot_participants`/
`pilot_feedback` (migration `0036`), a Super Admin `/admin/pilots` workspace, live activation/
monitoring/paid-conversion metrics computed from existing `domains`/`subscriptions` data, and
in-app feedback capture. **This is not commercial validation** — zero real external pilot
participants have been recruited (recruitment is a manual, one-to-one product-owner action, not
something this session performs), and `docs/pilot/PHASE_17_COMMERCIAL_VALIDATION_DECISION.md`
honestly records the verdict as pending/insufficient evidence. Separately, this phase found and
independently re-verified two real, live production Paddle subscriptions on the product owner's
own account — closing `docs/risks/ACTIVE_RISKS.md` RISK-001's technical sub-question while leaving
genuine commercial validation open. See
`docs/pilot/PHASE_17_PILOT_READY_AWAITING_EXTERNAL_EVIDENCE.md` for exactly what remains. Deploy
run `31711315061` completed cleanly, including its own smoke-test step. Independently re-verified
post-deploy: a direct D1 query confirmed migration `0036` applied and both new tables present and
empty; `/`, `/observatory` (regression check), an unauthenticated `/admin/pilots` (redirected to
`/sign-in`), and unauthenticated `/api/admin/pilots`/`/api/app/pilot/feedback` (both `401`) were
all checked directly against `https://crawlpact.com`.

Phase 18 (Production Launch Readiness and Final Audit) reached a **GO WITH ACCEPTED
NON-BLOCKING RISKS** decision on 2026-08-14, reconfirmed the same day via a full Phase 0-18
regression pass (found and fixed one real brand/logo defect — the historical C-bracket SVG in
`AuditReportView.tsx`, replaced with the current shield/checkmark mark), and is deployed to
production (commit `16fb160`, Worker version `280cac36-d3cb-4ca0-a7a2-03aab2c6ecf8`). See
`docs/reports/PHASE_00_18_FINAL_RECONFIRMATION_AND_PRODUCTION_RELEASE.md` for the reconfirmation
evidence. The prior HOLD's two forcing issues were
both genuinely resolved in this pass, not waived: RISK-002 (unrotated Paddle webhook signing
secret) was closed with a real replacement-destination rotation, verified end-to-end against live
production (`docs/security/PADDLE_WEBHOOK_SECRET_ROTATION_2026_08.md`); Gate E (commercial
validation) was resolved by an explicit, non-fabricated product-owner decision to defer external
commercial validation to Phase 19 (`docs/pilot/PHASE_17_OWNER_APPROVED_COMMERCIAL_VALIDATION_DEFERRAL.md`)
— real facts (0 external participants) are unchanged; what changed is whether the release requires
those facts to be different first. RISK-006 (`security_events`/`notifications` retention) and
RISK-018 (registry seed re-run immutability) were also genuinely fixed and tested. RISK-032
(Search Console) was honestly reclassified to POST-LAUNCH, not fabricated. The full canonical
quality gate re-ran clean end-to-end (402 unit, 350 integration confirmed via a clean sequential
re-run, 41 security, full validator suite, build), plus a full Playwright E2E re-run (243 passed,
1 flaky resolved on retry) and 34/34 independent production smoke checks post-deploy. See
`docs/release/PHASE_18_FINAL_GO_NO_GO_DECISION.md` for the formal decision record and
`docs/release/PHASE_18_LAUNCH_READINESS_MATRIX.md`/`PHASE_18_LAUNCH_RISK_MATRIX.md` for the
domain-by-domain evidence.

Phase 19 (Post-Launch Optimisation and Continuous Governance) foundation was established
2026-08-14 (docs-only pass, no application code changed, no Worker redeploy needed). Real
post-launch baseline recorded honestly: **0 external activated accounts, 0 external monitored
domains, 0 external paying customers, $0 external MRR** — 2 total accounts exist (1 owner Super
Admin holding both real subscriptions, 1 dormant non-admin account with zero saved domains). This
matches and reconfirms Phase 17's own finding. Risk register reconciled (stale "last reviewed"
header fixed; RISK-002/006/018 confirmed not reopened; RISK-032/003 reconfirmed accurate).
Commercial-validation operating plan, KPI/metric dictionary, north-star metric decision (external
monitored domains), conversion funnel baseline, capacity/security/registry/SEO operating policies,
and an evidence backlog were all established — see
`docs/reports/PHASE_19_FOUNDATION_COMPLETION_REPORT.md`. No Search Console connection was possible
(no Google-authenticated tool available, confirmed, not fabricated) — remains an open, documented
owner action. **This is a foundation, not a completion** — Phase 19 governance continues
indefinitely per its own §3.

Phase 16 (Policy Observatory and Research Authority, deployed 2026-08-11) added a Registry
Observatory (`/observatory`, `/observatory/registry`, `/observatory/methodology`) computed
exclusively from Phase 15's immutable registry releases, plus a governed research-publication
workflow (`/research`, `/research/[slug]`, Super Admin `/admin/research`) with draft/review/
publish/correct/withdraw states and a SHA-256 reproducibility checksum. The Website Policy
Observatory (a website-policy benchmark study) was deliberately not built — no approved research
corpus exists yet, and the phase explicitly favours a strong Registry Observatory over a weak or
unrepresentative website statistic; see `docs/research/PHASE_16_RESEARCH_CORPUS_DECISION.md`. No
research publication has been published to production — `/observatory` and `/research` correctly
show "nothing published yet," and this remains an open action for a future session with real
Super Admin credentials (`docs/research/PHASE_16_FIRST_RESEARCH_PUBLICATION_EVIDENCE.md`). Deploy
run `31512948445` (a first attempt, run `31512041616`, was correctly blocked — not failed — by the
deploy workflow's own "CI must have already succeeded for this exact commit" guard, since the
post-merge CI run on `main` hadn't finished at that instant; re-dispatching after CI completed
deployed cleanly). Independently re-verified post-deploy: a direct D1 query confirmed migration
`0035` applied and the active registry release unchanged at `2026.07.3`; `/`, `/observatory`,
`/observatory/registry`, `/observatory/methodology`, `/research`, `/research/<nonexistent-slug>`
(404), and an unauthenticated `/admin/research` request (redirected to `/sign-in`) were all
checked directly against `https://crawlpact.com`.

Phase 15 (Crawler Registry Governance and Public Changelog, deployed 2026-08-11) found and fixed
a real, critical bug: `getActiveRegistry()` and historical scan rendering read the live, mutable
`crawlers` table instead of the immutable `registry_version_entries` release snapshot, meaning
editing a crawler's row after a release was published could silently change what an already-active
release evaluated and how a historical scan displayed that crawler. Both paths now resolve
exclusively from the frozen release snapshot. Also fixed a second bug where any crawler edit —
including a source-URL move — counted identically to a real token/purpose change for
re-evaluation purposes; replaced with a field-level semantic diff so only evaluation-semantic
changes ever schedule customer re-evaluation. Made publish/rollback (registry and ruleset) atomic
and idempotent, added release checksums and candidate validation, gave rollback the same
re-evaluation parity as forward publish, and independently re-verified all 23 crawlers across 9
operators against live official documentation. **The active registry release is unchanged by this
deployment** (still `2026.07.3`) — publishing the reverified Amazon/Google/Bingbot corrections as
a new release requires a real, authenticated Super Admin session, which was not available during
this pass; the corrected data and the full validate/publish workflow are ready for whoever holds
production admin access. Deploy run `31483728804` completed cleanly on the first attempt,
including its own smoke-test step. Independently re-verified after deploy: a live read-only D1
query confirms migration `0034` applied and the active release still `2026.07.3`;
`https://crawlpact.com/`, `/crawlers`, `/changelog`, and an unauthenticated `/admin/operations`
request (redirects to `/sign-in`) were all checked directly. Full detail:
`docs/reports/PHASE_15_CRAWLER_REGISTRY_GOVERNANCE_COMPLETION_REPORT.md`.

Phase 14 (Status, Operations and Service Reliability, deployed 2026-08-11) strengthened the
existing status/incident/monitoring architecture rather than rebuilding it. Fixed two real,
previously-latent bugs: a status-query N+1 in `loadPublicIncidents`, and a scheduled-maintenance
incident escalating its public component before its actual `startsAt` time. Fixed a structural gap
that made the scheduler's stuck/overlapping-job detection unreachable (no code path ever wrote a
`running` row before job completion) and added a missing index on `scheduled_job_runs` found via
real `EXPLAIN QUERY PLAN` evidence. Added first-party, deduplicated internal operational alerting
(`operational_alerts`, pull-based, no third-party paging integration) and a Super Admin operations
control plane at `/admin/operations`. Defined internal SLIs/SLOs — **no public uptime percentage
is published** (the 7-condition gate is not met). Added a public status Atom feed
(`/status/feed.xml`). Evaluated and declined an independent status-plane Worker (kept `/status` in
the main Worker/D1). Two new D1 migrations (`0032`, `0033`; 33/33 applied). RISK-006's
`security_events`/`notifications` retention remains open — no explicit approval was given this
phase. The public 6-state status vocabulary and 7 canonical public components are unchanged. No
pricing/Paddle, crawler-classification/registry, monitoring-frequency, or notification-channel
change. Deploy run `31452008949` completed cleanly end-to-end on the first fully-green attempt for
this exact commit, including its own smoke-test step (a prior dispatch against the same commit was
blocked, not failed, by the deploy workflow's own "CI must have already succeeded for this exact
commit" guard, before the post-merge CI run on `main` had finished — resolved by waiting and
re-dispatching, not a deploy defect). Independently re-verified after deploy: a live read-only D1
query against `d1_migrations` confirms both migrations applied; `/status`, `/status/feed.xml`
(correct `atom+xml`/`noindex`/`cache-control` headers, valid empty feed), and an unauthenticated
`/admin/operations` request (redirects to `/sign-in`) were all checked directly against
`https://crawlpact.com`. Full detail:
`docs/reports/PHASE_14_STATUS_OPERATIONS_RELIABILITY_COMPLETION_REPORT.md`.

Phase 12 (Security, CI, Dependency and Quality-Gate Improvements, deployed 2026-08-10) hardened
CI/CD supply-chain integrity (SHA-pinned GitHub Actions, fixed a real script-injection shape, made
the dependency-vulnerability gate actually blocking), added a new privacy-minimized cross-request
target-frequency abuse-detection feature (detection-only, never auto-blocking), and root-caused
and fixed two real, previously-misdiagnosed operational gaps: the persistent `deploy-preview.yml`
failure (was missing Cloudflare Worker secrets, not a GitHub secret-naming mismatch as originally
documented) and a blocked Dependabot PR (a Wrangler version floor). Full detail:
`docs/reports/PHASE_12_SECURITY_CI_DEPENDENCY_QUALITY_COMPLETION_REPORT.md`.

Phase 13 (Analytics, Consent, Product Measurement and Private-Repository Exposure Governance,
deployed 2026-08-10) gated Google Analytics behind a real, first-party consent mechanism (no GA
script exists pre-consent, route-allowlisted), built the first-party Super Admin product-
measurement dashboard (`/admin/analytics`) SRS §28.13 has always named, added a PII-shaped
property guard and bounded `product_events` retention, fixed a production error-message leak, and
established repository-confidentiality governance (classification docs, surface inventories, two
new CI-gated validators — `repo-privacy:validate`, `analytics:validate`). No new D1 migration
(31/31 unchanged). **First deploy attempt** (run `31397059938`) reported a **transient smoke-test
failure**: Cloudflare's edge cache served a stale, pre-consent-gating copy of the homepage to the
CI runner for a brief window immediately after deploy (a known, pre-existing `must-revalidate`
caching quirk documented earlier in `docs/status/KNOWN_RISKS.md`; this session's Cloudflare API
credential cannot force a cache purge). The Worker itself deployed correctly on that first attempt
— only the automated smoke-test step, run seconds after deploy, hit stale content. A manual
`scripts/smoke-test.ts` re-run 3 minutes later showed 34/34 passing. The deploy was re-dispatched
(run `31398172686`) once the edge cache had settled and completed cleanly end-to-end, including
its own smoke-test step (34/34). Full detail:
`docs/reports/PHASE_13_ANALYTICS_CONSENT_PRODUCT_MEASUREMENT_COMPLETION_REPORT.md`.

An ad hoc Phase 19 maintenance pass (deployed 2026-08-17, run `31990452013`) closed two real,
previously-open risks and investigated two more without a code fix. **RISK-025** (duplicate-token
protection gap): `idx_crawlers_user_agent_token` used SQLite's default BINARY collation, so
case-variant duplicate crawler tokens (e.g. `Googlebot`/`googlebot`) could both be inserted despite
`registry-tools.mjs`'s validator already comparing case-insensitively — migration `0037` makes the
DB's own index `COLLATE NOCASE`, closing the gap at insert time. Independently re-verified live
post-deploy: `sqlite_master` confirms the index now reads
`CREATE UNIQUE INDEX idx_crawlers_user_agent_token ON crawlers (user_agent_token COLLATE NOCASE)`,
37/37 migrations applied. **RISK-026** (failing Dependabot PR): root-caused via direct local
reproduction — `@astrojs/cloudflare@14.2.0` imports `beginContentEntryCollection` from `astro/app`,
which `astro@7.1.3` (this repo's pinned version) doesn't export; bumping `astro` to `7.2.2`
alongside the adapter (not the adapter alone, as the Dependabot PR attempted) fixes the build.
Deploy completed cleanly end-to-end including its own smoke-test step; independently re-verified
post-deploy with a fresh `pnpm run smoke:production` run (34/34) and direct route checks against
`https://crawlpact.com`. **RISK-015** (built-server E2E) was retried given Wrangler is now well
past the version lead from Phase 12 — the historical crash reproduced again, this time locally on
macOS too (new evidence pointing at an upstream wrangler/Miniflare loopback custom-fetch bug, not
a Linux-CI-runner or Wrangler-version issue); the code change was reverted, **still open**.
**RISK-033** (Lighthouse) was investigated with a real controlled comparison and found to be a
genuine, currently-active, homepage-specific LCP regression present in **both** preview and
production (not the preview-only artifact previously assumed) — root cause not yet confirmed at
the time, flagged `open`. **Resolved in the next deployment, below.** Full detail:
`docs/risks/ACTIVE_RISKS.md`, `docs/risks/RISK_ARCHIVE.md` (ARC-038/039).

A follow-up deployment the same day (2026-08-17, run `32013679266`, commit `a1c18ca`) closed
RISK-033 for real. The homepage was never actually slow — Lighthouse's default `simulate`
throttling mode (the Lantern model) was badly misjudging its resource graph (11 script requests,
from the hydrated `AuditForm` island); three independent real-network measurements (an
out-of-band Playwright/CDP trace, and Lighthouse itself run 3x with
`--throttling-method=devtools`) all showed it genuinely healthy — 99–100/100, 700ms–1.6s LCP, in
both preview and production. Fixed the actual measurement (`scripts/lighthouse-check.mjs` now
uses devtools throttling), which then surfaced a second, real, previously-masked issue in the
opposite direction: `/sample-report` scored 83/100 (4.2s LCP) under real-network measurement.
`AnalyticsConsent.tsx` hardcoded its initial "has the visitor decided" state instead of using the
consent cookie `MarketingLayout.astro` already reads server-side, so a fresh visitor's first
paint never showed the banner — it flashed in ~2–3s later, and on `/sample-report`'s sparser
layout that delayed reveal became the LCP element. Fixed by threading the real server-read state
through as an `initialConsentState` prop. Independently re-verified post-deploy: a fresh-visitor
request to production's `/sample-report` now shows the banner immediately in the initial
server-rendered HTML (`initialConsentState` correctly serialized), and a live
devtools-throttled Lighthouse run against production scored 96/100 at 2.3s LCP (was 83–86/100,
3.9–4.2s pre-fix). Deploy completed cleanly end-to-end including its own smoke-test step;
independently re-verified with a fresh `pnpm run smoke:production` run (34/34) and direct route
checks against `https://crawlpact.com`. Full detail: `docs/risks/RISK_ARCHIVE.md` (ARC-040).

A final deployment the same day (2026-08-17, run `32019684129`, commit `027eb6f`) closed out a
leftover gap found while double-checking that everything genuinely reached production: a
Dependabot PR bumping `@astrojs/cloudflare` 14.2.0→14.2.1 (PR #131) had been rebased and verified
earlier but never actually merged. `@astrojs/cloudflare` is a real runtime `dependencies` entry
(the build adapter that generates the deployed Worker), not dev-tooling, so — unlike the earlier
pure-dev-tooling Dependabot merges this pass, which didn't need a redeploy — this one did. No
functional or schema change; pure build-dependency freshness. Deploy completed cleanly end-to-end
including its own smoke-test step; independently re-verified post-deploy: new Worker version live
at 100% via the Cloudflare deployments API, migrations unchanged at 37/37, a fresh
`pnpm run smoke:production` run (34/34), and direct checks on `/`, `/pricing`, `/sample-report`,
`/crawlers`, `/changelog`, `/status` (all 200).

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

**Phase 10 (Notification Channels and Monitoring Reliability) status**: merged and deployed to
production 2026-08-07, Worker version `5bee35c9-d16d-43c2-95c1-385d91be1a2a` (PR #95). Hardens the
two existing first-party notification channels (in-app centre, private Atom feed) and the
scheduled-monitoring pipeline — no third-party notification service added. Found and fixed three
real, previously undiscovered defects: notification-write failure could corrupt an
otherwise-successful scan's recorded monitoring state (notification generation now commits after
monitoring truth, fully failure-isolated); a mixed website+registry policy change could be
mislabelled as purely registry-driven (notification type selection now reads Phase 8's own
attribution model directly); and a CrawlPact-side (platform) scan failure counted toward the same
consecutive-failure pause threshold as a genuine target-side failure (a new failure taxonomy fixes
this). Adds database-level notification idempotency, incident-level failure-episode grouping, a
bounded independent notification-reconciliation job, and Atom feed entitlement re-checked on every
read (previously only at token issuance) plus response-header/metadata hardening. Closed RISK-024
(Atom feed test coverage) — archived as ARC-028. One additive migration (`0030`, 30/30 applied — new
columns/indexes only, no new tables). Notification preferences and five reserved notification-type
producers were evaluated against real code evidence and explicitly not implemented — see the
`docs/product/PHASE_10_*_DECISION.md` documents and `NOTIFICATION_TYPE_AND_PRODUCER_MATRIX.md`. All
new/changed routes and the migration independently re-verified live (direct production D1 queries
confirming the 9 new `notifications` columns, the `domains.failure_episode_id` column, and all 3 new
indexes, with the table count unchanged at 47; direct `curl` checks confirming `/app/notifications`
and `/api/notifications` correctly require authentication, and that the private Atom feed's
`Cache-Control: private, no-store` and `X-Robots-Tag: noindex, nofollow` headers are present on a
live invalid-token 404 response). See
`docs/reports/PHASE_10_NOTIFICATION_MONITORING_COMPLETION_REPORT.md` and `CHANGELOG.md`'s 2026-08-07
Phase 10 entry for full deployment evidence.

**Phase 19 (Pricing Comparison Table Strengthening) status**: merged and deployed to production
2026-08-18, Worker version `9efd4c33-9b64-4959-94f8-2f79a7d50294` (PR #134). Focused
presentation-layer UX improvement to `/pricing`: replaces the single 11-row comparison table with
four accessible semantic tables (core audit & reports; domains, history & monitoring; portfolio
workflows; agency capabilities), so a visitor can see immediately that every plan gets the same
complete audit and paid plans differ on scale/monitoring/history/workflow, not audit quality. No
pricing, entitlement, or checkout-architecture change; no D1 migration ("No migrations to apply!"
confirmed live during this deploy, still 37/37). Found and fixed two real defects while building
it: a history-retention rounding bug that showed Free's 30-day retention as "1 month" and
Agency's 1095-day retention as "37 months" instead of 36, and a genuine page-level
horizontal-scroll bug at 320px caused by having four sibling scrollable tables instead of one
(fixed with `contain:paint`). Independently re-verified post-deploy: a direct fetch of
`https://crawlpact.com/pricing` returns 200 and renders all four comparison sections with correct
plan/price/entitlement values (30 days/12/24/36 months, not 1/37), "Most Popular" only on Pro
(never Agency), 36 "Included" + 10 "Not included" cells matching the expected entitlement count
exactly, correct CTA hrefs, and unchanged JSON-LD offer count (7: 1 Free + 3 paid plans × 2
intervals); live Paddle production prices re-checked via `prices.list` and still match
`packages/database/seed/reference-data.sql` exactly (no drift); `smoke:production` passed 34/34
as part of the deploy workflow. Full detail:
`docs/optimization/PHASE_19_PRICING_COMPARISON_UX_IMPROVEMENT.md`.

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
- Phase 10 completion report: `docs/reports/PHASE_10_NOTIFICATION_MONITORING_COMPLETION_REPORT.md`
- Phase 11 completion report: `docs/reports/PHASE_11_DATABASE_STORAGE_PERFORMANCE_COMPLETION_REPORT.md`
- Phase 12 completion report: `docs/reports/PHASE_12_SECURITY_CI_DEPENDENCY_QUALITY_COMPLETION_REPORT.md`
- Phase 13 completion report: `docs/reports/PHASE_13_ANALYTICS_CONSENT_PRODUCT_MEASUREMENT_COMPLETION_REPORT.md`
- Phase 14 completion report: `docs/reports/PHASE_14_STATUS_OPERATIONS_RELIABILITY_COMPLETION_REPORT.md`
- Phase 15 completion report: `docs/reports/PHASE_15_CRAWLER_REGISTRY_GOVERNANCE_COMPLETION_REPORT.md`
- Phase 16 completion report: `docs/reports/PHASE_16_POLICY_OBSERVATORY_RESEARCH_AUTHORITY_COMPLETION_REPORT.md`
- Current risk register: `docs/risks/ACTIVE_RISKS.md`
- Changelog: `CHANGELOG.md`
- Requirements traceability: `docs/status/REQUIREMENTS_TRACEABILITY.md`
