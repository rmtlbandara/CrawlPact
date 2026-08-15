# CrawlPact Improvement Implementation Plan

Master roadmap and governance index, established by the Phase 0 baseline audit
(`docs/baseline/2026-08-03/`). This document is the authoritative phase index for the full
CrawlPact improvement programme (Phase 0 through Phase 19). It is a governance document — it does
not itself implement anything.

## How to use this document

- Each phase below has an Objective, Priority, Dependencies, Primary deliverables, Completion
  gate, Status, and links (populated once GitHub governance is actually applied — see
  `docs/governance/GITHUB_GOVERNANCE_SETUP_MANIFEST.md`).
- No phase may begin work outside its own stated scope. Discoveries outside a phase's scope are
  recorded in `docs/status/KNOWN_RISKS.md` or `docs/baseline/2026-08-03/BASELINE_RISKS_AND_UNKNOWNS.md`
  and routed to whichever phase actually owns that topic.
- Phase 0 is the evidence baseline every later phase's work must be consistent with. If a later
  phase's discovery contradicts something Phase 0 recorded, that later phase records the
  contradiction and updates the record — it does not silently override Phase 0's evidence.

## Phase index

| #   | Phase                                                      | Priority | Dependencies   | Status                                                                                                                                                                             |
| --- | ---------------------------------------------------------- | -------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Baseline, Audit Preservation and Implementation Governance | P0       | None           | **complete** (PR #68, merged `1a39d29`)                                                                                                                                            |
| 1   | Repository Documentation and Source-of-Truth Correction    | P0       | Phase 0        | **complete** (see `docs/reports/PHASE_01_DOCUMENTATION_SOURCE_OF_TRUTH_COMPLETION_REPORT.md`)                                                                                      |
| 2   | Brand Positioning and Messaging System                     | P1       | Phase 1        | **complete** (see `docs/reports/PHASE_02_BRAND_POSITIONING_MESSAGING_COMPLETION_REPORT.md`)                                                                                        |
| 3   | Legal Identity, Contact, Security and Trust Foundation     | P1       | Phase 1        | **complete** (see `docs/reports/PHASE_03_LEGAL_SECURITY_TRUST_COMPLETION_REPORT.md`)                                                                                               |
| 4   | Homepage Information Architecture and Conversion Redesign  | P1       | Phases 1–3     | **complete** (see `docs/reports/PHASE_04_HOMEPAGE_CONVERSION_REDESIGN_COMPLETION_REPORT.md`)                                                                                       |
| 5   | Anonymous Audit Result and Account-Conversion Flow         | P1       | Phase 4        | **complete** (see `docs/reports/PHASE_05_ANONYMOUS_AUDIT_CONVERSION_COMPLETION_REPORT.md`)                                                                                         |
| 6   | Pricing, Plan Architecture and Checkout Continuity         | P1       | Phase 4        | **complete** (see `docs/reports/PHASE_06_PRICING_PADDLE_CHECKOUT_COMPLETION_REPORT.md`)                                                                                            |
| 7   | Vertical Landing Pages and Platform SEO Architecture       | P2       | Phases 2–4     | **substantially complete** (PR #82, merged `4637e1a`, deployed to production; see `docs/reports/PHASE_07_VERTICAL_PLATFORM_SEO_COMPLETION_REPORT.md`)                              |
| 8   | Saved-Domain Experience and Change Timeline                | P1       | Phase 5        | **complete** (see `docs/reports/PHASE_08_SAVED_DOMAIN_CHANGE_TIMELINE_COMPLETION_REPORT.md`)                                                                                       |
| 9   | Agency Workspace and Portfolio Workflows                   | P2       | Phase 8        | **complete** (see `docs/reports/PHASE_09_AGENCY_WORKSPACE_PORTFOLIO_COMPLETION_REPORT.md`)                                                                                         |
| 10  | Notification Channels and Monitoring Reliability           | P1       | Phase 8, 9, 11 | **complete** (see `docs/reports/PHASE_10_NOTIFICATION_MONITORING_COMPLETION_REPORT.md`)                                                                                            |
| 11  | Database, Storage, Retention and Performance Hardening     | P0       | Phase 1        | **complete** (PR #86, merged `36166a4`, deployed to production; see `docs/reports/PHASE_11_DATABASE_STORAGE_PERFORMANCE_COMPLETION_REPORT.md`)                                     |
| 12  | Security, CI, Dependency and Quality-Gate Improvements     | P0       | Phase 1        | **complete** — deployed 2026-08-10 (see `docs/reports/PHASE_12_SECURITY_CI_DEPENDENCY_QUALITY_COMPLETION_REPORT.md`)                                                               |
| 13  | Analytics, Consent and Product Measurement Strategy        | P1       | Phase 1        | **complete** — deployed 2026-08-10, run `31398172686` (see `docs/reports/PHASE_13_ANALYTICS_CONSENT_PRODUCT_MEASUREMENT_COMPLETION_REPORT.md`)                                     |
| 14  | Status, Operations and Service Reliability                 | P1       | Phase 11       | **complete** — deployed 2026-08-11, run `31452008949` (see `docs/reports/PHASE_14_STATUS_OPERATIONS_RELIABILITY_COMPLETION_REPORT.md`)                                             |
| 15  | Crawler Registry Governance and Public Changelog           | P1       | Phase 1        | **complete** — deployed 2026-08-11, run `31483728804` (see `docs/reports/PHASE_15_CRAWLER_REGISTRY_GOVERNANCE_COMPLETION_REPORT.md`)                                               |
| 16  | Policy Observatory and Research Authority                  | P2       | Phase 15       | see detail section below (partially updated)                                                                                                                                       |
| 17  | Customer Pilot and Commercial Validation                   | P1       | Gates A–D      | **pre-launch technical readiness complete**; commercial validation deferred to Phase 19 (owner decision, 2026-08-14)                                                               |
| 18  | Production Launch Readiness and Final Audit                | P0       | Gates A–E      | **complete** — reconfirmed 2026-08-14 (`16fb160`, brand/logo fix + full regression re-verification, see `docs/reports/PHASE_00_18_FINAL_RECONFIRMATION_AND_PRODUCTION_RELEASE.md`) |
| 19  | Post-Launch Optimisation and Continuous Governance         | P1       | Phase 18       | **foundation established, 2026-08-14** — continuous governance active, not permanently complete (see `docs/reports/PHASE_19_FOUNDATION_COMPLETION_REPORT.md`)                      |

**Note on the "stale" flags above (resolved 2026-08-15):** the 2026-08-14 pass flagged that Phases
12–15's own detail sections below still read "not started," contradicting other
current-authoritative evidence in the repo. This was reconciled on 2026-08-15 against
`docs/status/CURRENT_STATE.md`'s dated deployment paragraphs, the four existing completion reports,
`git log` (confirmed distinct merged PRs and "docs: record production deployment" commits for all
four phases), and fresh live spot-checks against `https://crawlpact.com` (`/admin/operations` and
`/admin/analytics` redirect to sign-in as expected for unauthenticated requests, `/status/feed.xml`
returns `200`/`atom+xml`, `/changelog` returns `200`, all GitHub Actions workflows are
full-SHA-pinned, and the `operational_alerts`/`scheduled_job_runs`/`crawler_operators` D1 tables
exist in production). No contradicting evidence was found — the detail sections below have been
corrected to match.

## Phase details

### Phase 0 — Baseline, Audit Preservation and Implementation Governance

- **Objective**: Establish an evidence-backed, reproducible baseline of the repository and
  production system before any other change is made.
- **Primary deliverables**: `docs/baseline/2026-08-03/*`, this roadmap, the GitHub governance
  manifest, `scripts/baseline-validate.mjs`.
- **Completion gate**: all Phase 0 acceptance criteria in the Phase 0 completion report pass; no
  production/product/database/billing/registry change was made.
- **Status**: **complete** — merged to `main` via PR #68 (`1a39d29`), 2026-08-03.

### Phase 1 — Repository Documentation and Source-of-Truth Correction

- **Objective**: Resolve every conflict recorded in `docs/baseline/2026-08-03/DOCUMENTATION_CONFLICTS.md`
  (DC-001 through DC-015) — correct stale migration/table counts, R2-adoption claims, the
  self-contradicting AUDIT_ENGINE_ENABLED risk-ledger row, and refresh or retitle the three
  "Final" reports that predate six days of subsequent work.
- **Dependencies**: Phase 0.
- **Primary deliverables**: updated `IMPLEMENTATION_STATUS.md`, `KNOWN_RISKS.md`,
  `REQUIREMENTS_TRACEABILITY.md`, `SECURITY_CHECKLIST.md`; either refreshed or explicitly
  retitled `FINAL_*` reports; a REQUIREMENTS_TRACEABILITY.md row (or non-SRS appendix) for
  incident tracking.
- **Completion gate**: zero open P1/P2 documentation conflicts from the Phase 0 register remain
  unaddressed (fixed or explicitly re-classified as accepted/out-of-date-by-design).
- **Status**: **complete** — see
  `docs/reports/PHASE_01_DOCUMENTATION_SOURCE_OF_TRUTH_COMPLETION_REPORT.md`. All 15 tracked
  Phase 0 documentation conflicts resolved; the source-of-truth hierarchy
  (`docs/status/CURRENT_STATE.md`, `docs/risks/ACTIVE_RISKS.md`/`RISK_ARCHIVE.md`,
  `docs/governance/`, `docs/archive/implementation-history/`) is established;
  `pnpm docs:validate` added and passing; CI integration added.

### Phase 2 — Brand Positioning and Messaging System

- **Objective**: Establish a coherent brand/messaging system, informed by Phase 0's finding that
  the product is already faithful to the SRS with no fake trust signals.
- **Dependencies**: Phase 1.
- **Completion gate**: brand guide exists and is applied consistently across marketing surfaces.
- **Status**: **complete** — see
  `docs/reports/PHASE_02_BRAND_POSITIONING_MESSAGING_COMPLETION_REPORT.md`. Established
  `docs/brand/{BRAND_POSITIONING_AND_MESSAGING_SYSTEM,VOICE_AND_STYLE_GUIDE,
PRODUCT_TERMINOLOGY_GLOSSARY,CLAIMS_AND_MESSAGING_GUIDE,MESSAGING_SURFACE_INVENTORY}.md`,
  `apps/web/src/config/brand.ts`, and `pnpm brand:validate` (wired into CI). Three parallel
  research passes across every public/authenticated/admin/technical surface found **zero
  prohibited claims or fabricated proof already live** — Phase 2's corrective work was narrow
  (centralising duplicated brand strings, a handful of `minor-correction` wording fixes). One real
  documentation conflict was found and recorded rather than silently fixed: the SRS's own §2.3
  Primary Tagline ("Know what AI crawlers can access.") conflicts with the new canonical brand
  promise/tagline and with the live homepage's own promise sentence (SRS §2.2) — routed to Phase 3
  for an SRS update or ADR, tracked in `docs/risks/ACTIVE_RISKS.md`. Two completeness gaps (raw
  status-enum display in the authenticated scan-history list instead of `AuditReportView.tsx`'s
  existing `STATUS_LABEL` map; no customer-facing `scan_diffs` change-timeline UI) were found and
  deferred to Phase 8 (which already owns "Saved-Domain Experience and Change Timeline"), not
  fixed here.

### Phase 3 — Legal Identity, Contact, Security and Trust Foundation

- **Objective**: Resolve the legal-entity/address/jurisdiction/contact disclosure gap (see
  `BASELINE_RISKS_AND_UNKNOWNS.md` DC-010 context), add `security.txt` (missing per this baseline's
  live check), and close other trust-surface gaps.
- **Dependencies**: Phase 1.
- **Completion gate**: `/.well-known/security.txt` returns 200; legal identity disclosure
  decision made and either implemented or explicitly, permanently deferred with a documented
  reason (distinct from an SRS-mandated requirement, since the SRS does not impose one).
- **Status**: **complete** — see
  `docs/reports/PHASE_03_LEGAL_SECURITY_TRUST_COMPLETION_REPORT.md`. Approved operator name
  ("CrawlPact"), governing jurisdiction ("Sri Lanka"), and five contact addresses filled into
  `apps/web/src/lib/trust-config.ts` (previously all `null`); `/contact` and
  `/.well-known/security.txt` created; `/privacy` and `/terms` rewritten to the full required
  structure, verified directly against code; a real ownership-claim inaccuracy in `/terms` and
  `/acceptable-use` corrected (the free audit has no ownership-verification logic, contrary to
  what those pages previously stated); a full responsible-disclosure policy added to `/security`;
  a content/registry-correction process added to `/methodology`; `pnpm trust:validate` added
  (wired into CI). Registered address, registration number, and tax information remain
  deliberately unresolved (RISK-011, re-scoped and routed to Phase 18) — not invented. **This
  phase's actual scope, per its execution prompt, did not include reconciling SRS §2.3's tagline
  with the Phase 2 brand system, nor adding `package.json` description fields** — both remain
  open from Phase 2's routing and are carried forward to Phase 4 as unclaimed backlog items,
  rather than silently assumed done.

### Phase 4 — Homepage Information Architecture and Conversion Redesign

- **Objective**: Redesign homepage IA/conversion flow, informed by the route/capability baseline.
- **Dependencies**: Phases 1–3.
- **Status**: **complete** — see
  `docs/reports/PHASE_04_HOMEPAGE_CONVERSION_REDESIGN_COMPLETION_REPORT.md`. Homepage rebuilt to
  the required 12-section information architecture (`docs/design/HOMEPAGE_INFORMATION_ARCHITECTURE.md`);
  a new `/sample-report` route reuses the real `AuditReportView` component with a typed,
  schema-validated fixture (no duplicated report-rendering logic); a duplicated pricing array
  (`index.astro` vs. `pricing.astro`) was consolidated into one shared `apps/web/src/lib/plans.ts`
  module, with no price/limit/entitlement change. Production-build Lighthouse comparison (see
  `docs/design/PHASE_04_HOMEPAGE_BASELINE.md`) showed no measurable performance regression.
  **This phase's actual scope, per its execution prompt, again did not include reconciling SRS
  §2.3's tagline (RISK-028) or the `package.json` description-field gap** — both remain open,
  unclaimed by Phases 2, 3, or 4, and are carried forward to Phase 5.

### Phase 5 — Anonymous Audit Result and Account-Conversion Flow

- **Objective**: Improve the anonymous-audit → account-creation conversion path.
- **Dependencies**: Phase 4.
- **Status**: **complete** — see
  `docs/reports/PHASE_05_ANONYMOUS_AUDIT_CONVERSION_COMPLETION_REPORT.md`. Adds a contextual
  conversion CTA to the anonymous report (`docs/product/ANONYMOUS_REPORT_POLICY_SUMMARY_MAPPING.md`),
  a DB-backed, single-use, 60-minute continuation record (migration `0020_audit_continuations.sql`)
  carrying intent through sign-up/sign-in, and an authenticated handoff
  (`docs/product/AUDIT_CONVERSION_FLOW.md`) that adopts or reruns the original scan
  (`docs/product/ANONYMOUS_TO_AUTHENTICATED_BASELINE_POLICY.md`) and leaves monitoring paused until
  an explicit later opt-in. **This phase's execution prompt scoped it specifically to the
  conversion flow — it did not include the two backlog items the Phase 4 entry above provisionally
  assigned to Phase 5 (SRS §2.3 tagline reconciliation / RISK-028, and the 10 missing
  `package.json` `"description"` fields). Both remain open and are carried forward to Phase 6**,
  rather than assumed done or silently dropped.

### Phase 6 — Pricing, Plan Architecture and Checkout Continuity

- **Objective**: Fix the plan-consistency issues found in `BILLING_AND_PLAN_BASELINE.md` — most
  notably `pricing.astro`'s hard-coded plan array (SRS §8 violation), the dead
  `packages/core/src/api/contracts/billing.ts` module, and the downgrade-labelling UI defect
  ("Upgrade to X" shown for genuine downgrades). Run the first real paid checkout lifecycle under
  separate, explicit authorization. Also inherits two unclaimed backlog items neither Phase 2, 3,
  4, nor 5 addressed: reconciling SRS §2.3's Primary Tagline with the Phase 2 brand system (via ADR
  or SRS update — see `docs/brand/MESSAGING_SURFACE_INVENTORY.md` row E1 and RISK-028), and adding
  `"description"` fields to the 10 `package.json` files that currently lack one.
- **Dependencies**: Phase 4.
- **Completion gate**: pricing page reads from the `plans` table (or an equally single-sourced
  mechanism); downgrade UI is accurate; a real paid checkout has been run and verified at least
  once.
- **Status**: **substantially complete** — see
  `docs/reports/PHASE_06_PRICING_PADDLE_CHECKOUT_COMPLETION_REPORT.md`. Replaced the flat
  annual-only env-var price mapping with a DB-backed, multi-interval, multi-environment catalog
  (`plan_prices`, migration `0021`) driving `/pricing`, checkout, plan-change, the webhook
  processor, and Super Admin — closing the SRS §8 single-source-of-pricing violation. Fixed
  RISK-017 (upgrade/downgrade labelling) and closed RISK-016 (dead contract file deleted — see
  `docs/risks/RISK_ARCHIVE.md` ARC-024). **This phase's own completion gate is not fully met**: a
  real paid checkout was deliberately not run, consistent with the standing prohibition on
  triggering a real charge without separate, explicit authorization — RISK-001 remains open and is
  carried forward. The SRS §2.3 tagline reconciliation (RISK-028) and the `package.json`
  description-field gap were, per this phase's own execution prompt (scoped specifically to
  pricing/checkout), again not addressed and are carried forward to Phase 7, same as every prior
  phase this backlog has passed through.

### Phase 7 — Vertical Landing Pages and Platform SEO Architecture

- **Objective**: Build out additional SEO surface area beyond the current 20+ crawler-reference
  pages, 10 guides, and 5 free tools already in place — 4 audience-specific vertical landing pages
  and a source-verified platform-guide hub.
- **Dependencies**: Phases 2–4.
- **Completion gate**: 4/4 vertical pages and 5/5 priority platform guides built, source-cited,
  quality-gated (`pnpm content:validate`, `pnpm quality`, e2e/a11y/responsive suites green), and
  deployed to production.
- **Status**: **substantially complete** — see
  `docs/reports/PHASE_07_VERTICAL_PLATFORM_SEO_COMPLETION_REPORT.md`. Built and shipped 4/4 vertical
  landing pages (`/for/*`) and 5/5 priority platform guides plus the `/platforms` hub, all
  quality-gated. **This phase's own completion gate is not fully met on scope**: the 5 extended
  platform guides (nginx, apache, fastly, akamai, GitHub Pages) were deliberately deferred — the
  phase's own governing prompt permits this when the research/evidence bar isn't met in-session,
  and explicitly prohibits publishing thin content just to hit a count (RISK-031, carried forward).
  Two items Phase 6 noted as "carried forward to Phase 7" — the SRS §2.3 tagline reconciliation
  (RISK-028) and the `package.json` description-field gap — were, per this phase's own execution
  prompt (scoped specifically to vertical/platform SEO content, with an explicit prohibition on
  expanding into unrelated areas), again not addressed; carried forward to Phase 8.

### Phase 8 — Saved-Domain Experience and Change Timeline

- **Objective**: Improve the saved-domain dashboard and add a change-timeline view; close the
  export/report-export test-coverage gap identified in `CAPABILITY_MATRIX.md`. Also owns two
  gaps Phase 2 found and deferred (see `docs/brand/MESSAGING_SURFACE_INVENTORY.md` rows C3, C5):
  reusing `AuditReportView.tsx`'s existing `STATUS_LABEL`/`STATUS_TONE` maps in the authenticated
  domain-detail scan-history list instead of raw status-enum text, and a customer-facing UI
  surfacing `scan_diffs`/`diffType` (currently reachable only through the notification stream for
  high/critical-severity events). Also inherits two unclaimed backlog items neither Phase 6 nor
  Phase 7 addressed (each scoped to a different area): reconciling SRS §2.3's Primary Tagline with
  the Phase 2 brand system (RISK-028), and adding `"description"` fields to the 10 `package.json`
  files that currently lack one.
- **Dependencies**: Phase 5.
- **Status**: complete — merged and deployed to production; see
  `docs/reports/PHASE_08_SAVED_DOMAIN_CHANGE_TIMELINE_COMPLETION_REPORT.md`. Closed messaging-audit
  items C3 and C5 (scan-history now reuses `STATUS_LABEL`/`STATUS_TONE`; `scan_diffs`-equivalent
  data now has a real customer-facing timeline via the new `domain_change_events` table). The
  export/report-export test-coverage gap and the two unrelated backlog items (RISK-028 tagline
  reconciliation, `package.json` descriptions) were explicitly **not** absorbed into this pass —
  out of this phase's own stated scope (saved-domain experience and change timeline only); left
  open at their existing risk/backlog entries rather than silently dropped or silently expanded
  into.
- **Note**: the roadmap's original objective text above (written before this phase's own detailed
  execution prompt existed) also named "close the export/report-export test-coverage gap" and two
  unrelated backlog items as in-scope — the actual execution prompt this phase was run against
  scoped it to saved-domain experience and change timeline only, so those three items remain open,
  recorded honestly here rather than silently claimed complete.

### Phase 9 — Agency Workspace and Portfolio Workflows

- **Objective**: Extend agency-tier features; fix the orphaned-R2-logo-object cleanup gap on bulk
  share revocation and account/domain-deletion purge (`BASELINE_RISKS_AND_UNKNOWNS.md`, existing
  risk).
- **Dependencies**: Phase 8.
- **Status**: complete — merged and deployed to production; see
  `docs/reports/PHASE_09_AGENCY_WORKSPACE_PORTFOLIO_COMPLETION_REPORT.md`. Added an agency/portfolio
  workspace, explainable portfolio summary and attention queue, account-wide change feed, safe
  non-empty group deletion, server-side-paginated portfolio table, CSV file batch import, extended
  CSV export, bounded bulk actions, a persistent agency-branding profile, and saved views. Closed
  RISK-010 (R2 logo orphan cleanup) via a new daily-cron sweep category, exactly per that risk's own
  stated closure criterion — archived as ARC-027. Team roles, a client portal, bulk rescan, a
  multi-domain portfolio-report product, and cross-domain comparison were evaluated against the SRS
  and explicitly not implemented — see the six `docs/product/PHASE_09_*_DECISION.md` documents.

### Phase 10 — Notification Channels and Monitoring Reliability

- **Objective**: Add test coverage for the Atom feed route (`R-012`), and harden notification
  delivery.
- **Dependencies**: Phase 8, Phase 9, Phase 11.
- **Status**: complete — see
  `docs/reports/PHASE_10_NOTIFICATION_MONITORING_COMPLETION_REPORT.md`. Fixed two real, previously
  undiscovered bugs: notification-write failure could corrupt an otherwise-successful scan's
  monitoring state (reordered to commit monitoring truth first, failure-isolated), and a mixed
  website+registry change could be mislabelled as purely registry-driven (notification generation
  now uses Phase 8's own attribution model directly instead of a separate, cruder drift check).
  Added notification dedupe/idempotency (D1-level unique index), incident-level failure-episode
  grouping, target-vs-platform failure classification (a platform-side failure never counts toward
  a domain's pause threshold — a second real bug fixed), bounded notification reconciliation, and
  Atom feed read-time entitlement re-checking plus metadata/header hardening. Closed RISK-024 (Atom
  feed test coverage) — archived as ARC-028. No third-party notification channel was added; no
  monitoring cadence, pricing, or crawler-classification change. `new_crawler`,
  `crawler_purpose_change`, `subscription_issue`, `shared_report_expiry`, `platform_notice`, and a
  fine-grained preference system were all evaluated and explicitly not implemented — see the
  `docs/product/PHASE_10_*_DECISION.md` documents.

### Phase 11 — Database, Storage, Retention and Performance Hardening

- **Objective**: Fix `scan_diffs`'s missing `ON DELETE` clause (R-005, same bug class already
  fixed for 14 other columns); resolve the 40-vs-39 table-count discrepancy (R-006); add a purge
  job for `product_events`/`security_events`/`notifications`; address the quantified Workers-Free
  CPU-budget risk for scan/monitoring.
- **Dependencies**: Phase 1.
- **Completion gate**: `scan_diffs` FKs have explicit `ON DELETE` behavior; table-count
  discrepancy explained/fixed; a documented decision exists for the three no-purge-job tables.
- **Status**: complete — merged (PR #86, `36166a4`; follow-up test-timeout fix PR #87) and
  deployed to production 2026-08-05 (Worker `7d1b4cc4-2232-4c21-9f91-5b154f94e5c2`).
  `scan_diffs`/`audit_continuations` FKs fixed (migrations `0022`/`0023`, independently
  re-verified live via production `PRAGMA foreign_key_list`); the table-count discrepancy
  re-measured and found not to reproduce against current schema/production (42=42 exact match); a
  documented decision recorded for the three no-purge-job tables
  (`docs/data/PHASE_11_RETENTION_DECISION_MATRIX.md` — implementation deferred pending approval,
  per the phase's own scope boundary, not because the decision itself is incomplete); the
  CPU-budget risk re-modeled with concrete tightening measures shipped
  (`docs/operations/PHASE_11_CLOUDFLARE_PLAN_DECISION.md`). Full detail:
  `docs/reports/PHASE_11_DATABASE_STORAGE_PERFORMANCE_COMPLETION_REPORT.md`.

### Phase 12 — Security, CI, Dependency and Quality-Gate Improvements

- **Objective**: Investigate and fix the failing Dependabot CI run (R-009); consider GitHub
  branch-protection alternatives given the current plan's constraint (R-008); remove the dead
  `packages/core` billing contract module or reconcile it with the real API shape.
- **Dependencies**: Phase 1.
- **Status**: **complete** — deployed 2026-08-10. Hardened CI/CD supply-chain integrity
  (SHA-pinned GitHub Actions, fixed a real script-injection shape, made the
  dependency-vulnerability gate actually blocking), added a privacy-minimized cross-request
  target-frequency abuse-detection feature (detection-only, never auto-blocking), and root-caused
  and fixed two real, previously-misdiagnosed operational gaps: the persistent
  `deploy-preview.yml` failure (missing Cloudflare Worker secrets, not a GitHub secret-naming
  mismatch as originally documented) and a blocked Dependabot PR (a Wrangler version floor).
  Live-reconfirmed 2026-08-15: `ci.yml`/`deploy-production.yml`/`deploy-preview.yml` are all
  full-SHA-pinned. Full detail:
  `docs/reports/PHASE_12_SECURITY_CI_DEPENDENCY_QUALITY_COMPLETION_REPORT.md`.

### Phase 13 — Analytics, Consent and Product Measurement Strategy

- **Objective**: Decide on a cookie-consent mechanism for the GA deviation (R-011); add a
  regression test asserting GA never loads outside `MarketingLayout` (R-010); build the SRS
  §28.13 14-metric Super Admin analytics dashboard (currently absent, per `ANALYTICS_AND_CONSENT_BASELINE.md`).
- **Dependencies**: Phase 1.
- **Status**: **complete** — deployed 2026-08-10, run `31398172686` (first attempt, run
  `31397059938`, hit a transient post-deploy edge-cache smoke-test failure, not a real Worker
  defect; re-dispatch completed cleanly, 34/34 smoke checks). Gated Google Analytics behind a
  real, first-party consent mechanism (no GA script exists pre-consent, route-allowlisted), built
  the first-party Super Admin product-measurement dashboard (`/admin/analytics`), added a
  PII-shaped property guard and bounded `product_events` retention, fixed a production
  error-message leak, and established repository-confidentiality governance
  (`repo-privacy:validate`, `analytics:validate`, both CI-gated). No new D1 migration (31/31
  unchanged at time of deploy). Live-reconfirmed 2026-08-15: unauthenticated `/admin/analytics`
  redirects to `/sign-in`; `scripts/analytics-validate.mjs` and
  `scripts/repo-privacy-validate.mjs` exist. Full detail:
  `docs/reports/PHASE_13_ANALYTICS_CONSENT_PRODUCT_MEASUREMENT_COMPLETION_REPORT.md`.

### Phase 14 — Status, Operations and Service Reliability

- **Objective**: Verify cron execution history (not just configuration); formalize
  `scripts/smoke-test.ts` as a required, not just manual, post-deploy gate.
- **Dependencies**: Phase 11.
- **Status**: **complete** — deployed 2026-08-11, run `31452008949`. Fixed two real,
  previously-latent bugs: a status-query N+1 in `loadPublicIncidents`, and a
  scheduled-maintenance incident escalating its public component before its actual `startsAt`
  time. Fixed a structural gap that made the scheduler's stuck/overlapping-job detection
  unreachable, and added a missing index on `scheduled_job_runs` found via real
  `EXPLAIN QUERY PLAN` evidence. Added first-party, deduplicated internal operational alerting
  (`operational_alerts`) and a Super Admin operations control plane at `/admin/operations`.
  Defined internal SLIs/SLOs — no public uptime percentage is published. Added a public status
  Atom feed (`/status/feed.xml`). Two new D1 migrations (`0032`, `0033`; 33/33 applied at time of
  deploy). RISK-006 retention was resolved separately in the later Phase 0-18 blocker-removal
  pass, not this phase. Live-reconfirmed 2026-08-15: unauthenticated `/admin/operations` redirects
  to `/sign-in`; `/status/feed.xml` returns `200` with `content-type: application/atom+xml`; the
  `operational_alerts`/`scheduled_job_runs` D1 tables exist in production. Full detail:
  `docs/reports/PHASE_14_STATUS_OPERATIONS_RELIABILITY_COMPLETION_REPORT.md`.

### Phase 15 — Crawler Registry Governance and Public Changelog

- **Objective**: Fix the crawler/operator count self-contradiction within
  `CRAWLER_REGISTRY_GOVERNANCE.md` (DC-013), update the stale "no interactive publish UI" claim
  (DC-014), fix the case-sensitivity mismatch between the DB unique index and the CLI duplicate
  check (R-004), and address the `reference-data.sql` re-run immutability risk (R-003). Add the
  Bingbot content page once its JS-rendered official source becomes fetchable.
- **Dependencies**: Phase 1.
- **Status**: **complete** — deployed 2026-08-11, run `31483728804`. Found and fixed a real,
  critical bug: `getActiveRegistry()` and historical scan rendering read the live, mutable
  `crawlers` table instead of the immutable `registry_version_entries` release snapshot, meaning
  editing a crawler's row after a release was published could silently change what an
  already-active release evaluated. Both paths now resolve exclusively from the frozen release
  snapshot (regression-tested — RISK-018). Also replaced whole-row-edit re-evaluation triggering
  with a field-level semantic diff so only evaluation-semantic changes schedule customer
  re-evaluation. Made publish/rollback atomic and idempotent, added release checksums and
  candidate validation, and independently re-verified all 23 crawlers across 9 operators against
  live official documentation. The active registry release itself was unchanged by this deployment
  (`2026.07.3`) — publishing the reverified Amazon/Google/Bingbot corrections as a new release
  remains a pending Super Admin action (`docs/registry/PHASE_19_REGISTRY_MAINTENANCE_POLICY.md`).
  Migration `0034` applied (34/34 at time of deploy). Live-reconfirmed 2026-08-15: `/changelog`
  returns `200`; the `crawler_operators` D1 table exists in production. Full detail:
  `docs/reports/PHASE_15_CRAWLER_REGISTRY_GOVERNANCE_COMPLETION_REPORT.md`.

### Phase 16 — Policy Observatory and Research Authority

- **Objective**: Build research/authority content on top of the now-governance-hardened registry.
- **Dependencies**: Phase 15.
- **Status**: Registry Observatory (Layer A) shipped — `/observatory`, `/observatory/registry`,
  `/observatory/methodology`, `/research`, `/research/[slug]`, `/admin/research` publication
  workflow, full research-governance/methodology documentation. Website Policy Observatory
  (Layer B) deliberately deferred — see `docs/research/PHASE_16_RESEARCH_CORPUS_DECISION.md`. No
  publication has been published to production yet — see
  `docs/research/PHASE_16_FIRST_RESEARCH_PUBLICATION_EVIDENCE.md`.

### Phase 17 — Customer Pilot and Commercial Validation

- **Objective**: Run a real customer pilot once Gates A–D are met.
- **Dependencies**: Gates A–D.
- **Status**: **pre-launch technical readiness complete; external commercial validation
  explicitly deferred to Phase 19 by owner decision, 2026-08-14.** Pilot cohort/participant/
  feedback data model, Super Admin `/admin/pilots` workspace, in-app feedback capture, and
  activation/monitoring/paid-conversion metrics (derived live from existing product data) are
  built and tested. Zero real external pilot participants have been recruited — recruitment
  requires the human product owner, not an autonomous coding agent. This remains true; what
  changed is that the product owner explicitly decided the release does not need to wait for it.
  See `docs/pilot/PHASE_17_PILOT_READY_AWAITING_EXTERNAL_EVIDENCE.md` and
  `docs/pilot/PHASE_17_OWNER_APPROVED_COMMERCIAL_VALIDATION_DEFERRAL.md`.

### Phase 18 — Production Launch Readiness and Final Audit

- **Objective**: A final, current (not six-days-stale) SRS/security/production-readiness audit
  superseding the three "Final" reports Phase 1 will have already refreshed.
- **Dependencies**: Gates A–E.
- **Status**: **complete — GO WITH ACCEPTED NON-BLOCKING RISKS, deployed to production
  2026-08-14** (commit `d25fe4f`, Worker version `699d87d8-767a-4cc9-ab70-a279979029fb`). The
  prior HOLD's two forcing conditions were both genuinely resolved, not waived: RISK-002
  (unrotated Paddle webhook secret) was closed with a real, verified rotation; Gate E was resolved
  by the explicit owner deferral decision above. RISK-006 and RISK-018 were also genuinely fixed
  and tested; RISK-032 was honestly reclassified to POST-LAUNCH. See
  `docs/release/PHASE_18_FINAL_GO_NO_GO_DECISION.md` and
  `docs/reports/PHASE_18_PRODUCTION_LAUNCH_READINESS_FINAL_AUDIT.md`.

### Phase 19 — Post-Launch Optimisation and Continuous Governance

- **Objective**: Ongoing governance after launch readiness — not a terminal phase. **Updated
  2026-08-14**: explicitly inherits full ownership of genuine external commercial validation,
  deferred from Phase 17 by owner decision — see
  `docs/pilot/PHASE_17_OWNER_APPROVED_COMMERCIAL_VALIDATION_DEFERRAL.md` and
  `docs/roadmap/PHASE_19_POST_LAUNCH_HANDOFF.md`. This must not silently drop off the roadmap.
- **Dependencies**: Phase 18.
- **Status**: **foundation established, 2026-08-14** — real post-launch baseline recorded (0
  external users/paying customers, honestly disclosed), risk register reconciled, commercial-
  validation operating plan established (cross-referencing Phase 17's frozen criteria), KPI
  dictionary and north-star metric (external monitored domains) decided, evidence backlog
  created. Not permanently complete — continuous governance remains ongoing per this phase's own
  §3. See `docs/reports/PHASE_19_FOUNDATION_COMPLETION_REPORT.md`.

## Release gates

| Gate                              | Requires                                                                  |
| --------------------------------- | ------------------------------------------------------------------------- |
| A — Trust-ready                   | Phases 0, 1, 2, 3 — **complete** (all four phases done, 2026-08-03)       |
| B — Conversion-ready              | Phases 4, 5, 6 — **complete** (all three done, 2026-08-04)                |
| C — Agency-ready                  | Phases 8, 9, 10 — **complete** (all three done, 2026-08-07)               |
| D — Scale-ready                   | Phases 11, 12, 13, 14                                                     |
| E — Authority and Pilot-Readiness | **Superseded definition, 2026-08-14 — satisfied**                         |
| F — Public-growth-ready           | Phase 18 — **complete, 2026-08-14** (GO WITH ACCEPTED NON-BLOCKING RISKS) |

**Gate E — superseded 2026-08-14.** The original definition (Phases 15, 16, 17, all with Phase
17's external-commercial-validation criterion fully met) is preserved here for history, not
erased. It is superseded by an explicit owner decision recorded in
`docs/pilot/PHASE_17_OWNER_APPROVED_COMMERCIAL_VALIDATION_DEFERRAL.md`. Gate E now reads:

> Gate E — Authority and Pilot-Readiness. Requires: Phase 15 registry governance, Phase 16
> Observatory/research authority foundation, Phase 17 pilot technical readiness, and an explicit
> owner-approved deferral of external commercial validation to Phase 19. This does not claim that
> external commercial validation has already occurred.

Gate E is satisfied under this revised definition: Phases 15–17's technical deliverables are
confirmed live, and the deferral above is recorded. **Gate F is satisfied**: the Phase 0-18 final
production release pass reached a GO WITH ACCEPTED NON-BLOCKING RISKS decision, reconfirmed
2026-08-14 with a brand/logo fix and full regression re-verification, commit `16fb160` deployed to
production (Worker version `280cac36-d3cb-4ca0-a7a2-03aab2c6ecf8`) — see
`docs/release/PHASE_18_FINAL_GO_NO_GO_DECISION.md` and
`docs/reports/PHASE_00_18_FINAL_RECONFIRMATION_AND_PRODUCTION_RELEASE.md`.

Phase 19 is ongoing governance after launch readiness, not gated — its foundation was established
2026-08-14; see `docs/reports/PHASE_19_FOUNDATION_COMPLETION_REPORT.md` for what it owns going
forward, and `docs/roadmap/PHASE_19_POST_LAUNCH_HANDOFF.md` for the original handoff.

## GitHub governance

Milestones, labels, and issues for this programme are **not yet created** in the GitHub repository
— per explicit user decision during Phase 0, only a setup manifest was produced. See
`docs/governance/GITHUB_GOVERNANCE_SETUP_MANIFEST.md` for exact milestone names, label names, issue
titles, and complete issue bodies, ready to apply via the included `gh` commands whenever
authorized.

## Baseline reference

Every phase above must treat `docs/baseline/2026-08-03/` as the evidence baseline. If a later
phase's own investigation contradicts a Phase 0 finding, that phase records the contradiction
(in its own completion report and in `docs/risks/ACTIVE_RISKS.md`) rather than silently treating
its own finding as automatically correct — Phase 0's evidence precedence rules
(`docs/baseline/2026-08-03/PHASE_0_BASELINE_REPORT.md` §"Evidence precedence") still apply. As of
Phase 1 (2026-08-03), the day-to-day current-state reference is
`docs/status/CURRENT_STATE.md`, kept consistent with the Phase 0 baseline rather than
duplicating it.
