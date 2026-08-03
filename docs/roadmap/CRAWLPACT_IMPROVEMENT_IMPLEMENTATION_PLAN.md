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

| #   | Phase                                                      | Priority | Dependencies | Status                                                                                        |
| --- | ---------------------------------------------------------- | -------- | ------------ | --------------------------------------------------------------------------------------------- |
| 0   | Baseline, Audit Preservation and Implementation Governance | P0       | None         | **complete** (PR #68, merged `1a39d29`)                                                       |
| 1   | Repository Documentation and Source-of-Truth Correction    | P0       | Phase 0      | **complete** (see `docs/reports/PHASE_01_DOCUMENTATION_SOURCE_OF_TRUTH_COMPLETION_REPORT.md`) |
| 2   | Brand Positioning and Messaging System                     | P1       | Phase 1      | **complete** (see `docs/reports/PHASE_02_BRAND_POSITIONING_MESSAGING_COMPLETION_REPORT.md`)   |
| 3   | Legal Identity, Contact, Security and Trust Foundation     | P1       | Phase 1      | not started                                                                                   |
| 4   | Homepage Information Architecture and Conversion Redesign  | P1       | Phases 1–3   | not started                                                                                   |
| 5   | Anonymous Audit Result and Account-Conversion Flow         | P1       | Phase 4      | not started                                                                                   |
| 6   | Pricing, Plan Architecture and Checkout Continuity         | P1       | Phase 4      | not started                                                                                   |
| 7   | Vertical Landing Pages and Platform SEO Architecture       | P2       | Phases 2–4   | not started                                                                                   |
| 8   | Saved-Domain Experience and Change Timeline                | P1       | Phase 5      | not started                                                                                   |
| 9   | Agency Workspace and Portfolio Workflows                   | P2       | Phase 8      | not started                                                                                   |
| 10  | Notification Channels and Monitoring Reliability           | P1       | Phase 8      | not started                                                                                   |
| 11  | Database, Storage, Retention and Performance Hardening     | P0       | Phase 1      | not started                                                                                   |
| 12  | Security, CI, Dependency and Quality-Gate Improvements     | P0       | Phase 1      | not started                                                                                   |
| 13  | Analytics, Consent and Product Measurement Strategy        | P1       | Phase 1      | not started                                                                                   |
| 14  | Status, Operations and Service Reliability                 | P1       | Phase 11     | not started                                                                                   |
| 15  | Crawler Registry Governance and Public Changelog           | P1       | Phase 1      | not started                                                                                   |
| 16  | Policy Observatory and Research Authority                  | P2       | Phase 15     | not started                                                                                   |
| 17  | Customer Pilot and Commercial Validation                   | P1       | Gates A–D    | not started                                                                                   |
| 18  | Production Launch Readiness and Final Audit                | P0       | Gates A–E    | not started                                                                                   |
| 19  | Post-Launch Optimisation and Continuous Governance         | P1       | Phase 18     | not started                                                                                   |

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
  live check), and close other trust-surface gaps. Also owns reconciling SRS §2.3's Primary
  Tagline with the Phase 2 brand system (via ADR or SRS update — see Phase 2's status above and
  `docs/brand/MESSAGING_SURFACE_INVENTORY.md` row E1) and, as low-priority consistency work,
  adding `"description"` fields to the 10 `package.json` files that currently lack one.
- **Dependencies**: Phase 1.
- **Completion gate**: `/.well-known/security.txt` returns 200; legal identity disclosure
  decision made and either implemented or explicitly, permanently deferred with a documented
  reason (distinct from an SRS-mandated requirement, since the SRS does not impose one); SRS §2.3
  reconciled with the Phase 2 brand system.
- **Status**: not started.

### Phase 4 — Homepage Information Architecture and Conversion Redesign

- **Objective**: Redesign homepage IA/conversion flow, informed by the route/capability baseline.
- **Dependencies**: Phases 1–3.
- **Status**: not started.

### Phase 5 — Anonymous Audit Result and Account-Conversion Flow

- **Objective**: Improve the anonymous-audit → account-creation conversion path.
- **Dependencies**: Phase 4.
- **Status**: not started.

### Phase 6 — Pricing, Plan Architecture and Checkout Continuity

- **Objective**: Fix the plan-consistency issues found in `BILLING_AND_PLAN_BASELINE.md` — most
  notably `pricing.astro`'s hard-coded plan array (SRS §8 violation), the dead
  `packages/core/src/api/contracts/billing.ts` module, and the downgrade-labelling UI defect
  ("Upgrade to X" shown for genuine downgrades). Run the first real paid checkout lifecycle under
  separate, explicit authorization.
- **Dependencies**: Phase 4.
- **Completion gate**: pricing page reads from the `plans` table (or an equally single-sourced
  mechanism); downgrade UI is accurate; a real paid checkout has been run and verified at least
  once.
- **Status**: not started.

### Phase 7 — Vertical Landing Pages and Platform SEO Architecture

- **Objective**: Build out additional SEO surface area beyond the current 20+ crawler-reference
  pages, 10 guides, and 5 free tools already in place.
- **Dependencies**: Phases 2–4.
- **Status**: not started.

### Phase 8 — Saved-Domain Experience and Change Timeline

- **Objective**: Improve the saved-domain dashboard and add a change-timeline view; close the
  export/report-export test-coverage gap identified in `CAPABILITY_MATRIX.md`. Also owns two
  gaps Phase 2 found and deferred (see `docs/brand/MESSAGING_SURFACE_INVENTORY.md` rows C3, C5):
  reusing `AuditReportView.tsx`'s existing `STATUS_LABEL`/`STATUS_TONE` maps in the authenticated
  domain-detail scan-history list instead of raw status-enum text, and a customer-facing UI
  surfacing `scan_diffs`/`diffType` (currently reachable only through the notification stream for
  high/critical-severity events).
- **Dependencies**: Phase 5.
- **Status**: not started.

### Phase 9 — Agency Workspace and Portfolio Workflows

- **Objective**: Extend agency-tier features; fix the orphaned-R2-logo-object cleanup gap on bulk
  share revocation and account/domain-deletion purge (`BASELINE_RISKS_AND_UNKNOWNS.md`, existing
  risk).
- **Dependencies**: Phase 8.
- **Status**: not started.

### Phase 10 — Notification Channels and Monitoring Reliability

- **Objective**: Add test coverage for the Atom feed route (`R-012`), and harden notification
  delivery.
- **Dependencies**: Phase 8.
- **Status**: not started.

### Phase 11 — Database, Storage, Retention and Performance Hardening

- **Objective**: Fix `scan_diffs`'s missing `ON DELETE` clause (R-005, same bug class already
  fixed for 14 other columns); resolve the 40-vs-39 table-count discrepancy (R-006); add a purge
  job for `product_events`/`security_events`/`notifications`; address the quantified Workers-Free
  CPU-budget risk for scan/monitoring.
- **Dependencies**: Phase 1.
- **Completion gate**: `scan_diffs` FKs have explicit `ON DELETE` behavior; table-count
  discrepancy explained/fixed; a documented decision exists for the three no-purge-job tables.
- **Status**: not started.

### Phase 12 — Security, CI, Dependency and Quality-Gate Improvements

- **Objective**: Investigate and fix the failing Dependabot CI run (R-009); consider GitHub
  branch-protection alternatives given the current plan's constraint (R-008); remove the dead
  `packages/core` billing contract module or reconcile it with the real API shape.
- **Dependencies**: Phase 1.
- **Status**: not started.

### Phase 13 — Analytics, Consent and Product Measurement Strategy

- **Objective**: Decide on a cookie-consent mechanism for the GA deviation (R-011); add a
  regression test asserting GA never loads outside `MarketingLayout` (R-010); build the SRS
  §28.13 14-metric Super Admin analytics dashboard (currently absent, per `ANALYTICS_AND_CONSENT_BASELINE.md`).
- **Dependencies**: Phase 1.
- **Status**: not started.

### Phase 14 — Status, Operations and Service Reliability

- **Objective**: Verify cron execution history (not just configuration); formalize
  `scripts/smoke-test.ts` as a required, not just manual, post-deploy gate.
- **Dependencies**: Phase 11.
- **Status**: not started.

### Phase 15 — Crawler Registry Governance and Public Changelog

- **Objective**: Fix the crawler/operator count self-contradiction within
  `CRAWLER_REGISTRY_GOVERNANCE.md` (DC-013), update the stale "no interactive publish UI" claim
  (DC-014), fix the case-sensitivity mismatch between the DB unique index and the CLI duplicate
  check (R-004), and address the `reference-data.sql` re-run immutability risk (R-003). Add the
  Bingbot content page once its JS-rendered official source becomes fetchable.
- **Dependencies**: Phase 1.
- **Status**: not started.

### Phase 16 — Policy Observatory and Research Authority

- **Objective**: Build research/authority content on top of the now-governance-hardened registry.
- **Dependencies**: Phase 15.
- **Status**: not started.

### Phase 17 — Customer Pilot and Commercial Validation

- **Objective**: Run a real customer pilot once Gates A–D are met.
- **Dependencies**: Gates A–D.
- **Status**: not started.

### Phase 18 — Production Launch Readiness and Final Audit

- **Objective**: A final, current (not six-days-stale) SRS/security/production-readiness audit
  superseding the three "Final" reports Phase 1 will have already refreshed.
- **Dependencies**: Gates A–E.
- **Status**: not started.

### Phase 19 — Post-Launch Optimisation and Continuous Governance

- **Objective**: Ongoing governance after launch readiness — not a terminal phase.
- **Dependencies**: Phase 18.
- **Status**: not started (ongoing once reached).

## Release gates

| Gate                    | Requires                                                  |
| ----------------------- | --------------------------------------------------------- |
| A — Trust-ready         | Phases 0, 1, 2, 3 (0 and 1 complete; 2 and 3 not started) |
| B — Conversion-ready    | Phases 4, 5, 6                                            |
| C — Agency-ready        | Phases 8, 9, 10                                           |
| D — Scale-ready         | Phases 11, 12, 13, 14                                     |
| E — Authority-ready     | Phases 15, 16, 17                                         |
| F — Public-growth-ready | Phase 18                                                  |

Phase 19 is ongoing governance after launch readiness, not gated.

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
