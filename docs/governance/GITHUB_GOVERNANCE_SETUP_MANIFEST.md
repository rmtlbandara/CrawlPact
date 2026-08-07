# GitHub Governance Setup Manifest — 2026-08-03

**Status: verification-blocked (by user decision, not access failure).**

## Phase 10 update (2026-08-07)

Phase 10 (Notification Channels and Monitoring Reliability) is **complete** — see
`docs/reports/PHASE_10_NOTIFICATION_MONITORING_COMPLETION_REPORT.md`. Same manifest-only decision
carried forward — no live GitHub issue created. When this manifest is applied, create:

- **"Harden monitoring reliability and notification delivery"** — already **resolved** by this
  pass; record as closed-on-creation with a link to the completion report and the merge commit.
- Real content: notification generation reordered to commit monitoring truth first and isolated
  from failure (a thrown notification-write error can no longer corrupt an otherwise-successful
  scan's state); notification dedupe/idempotency enforced at the D1 level; incident-level grouping
  for repeated target-side scan failures; a target-vs-platform failure taxonomy (a CrawlPact-side
  processing error never counts toward a domain's consecutive-failure pause threshold); a bounded,
  independent notification-reconciliation job; private Atom feed entitlement now re-checked on
  every read (not just at token issuance), plus response-header and feed-metadata hardening. Closed
  RISK-024 (Atom feed test coverage) — archived as ARC-028. Found and fixed two real, previously
  undiscovered defects along the way: the notification-failure state-corruption bug above, and a
  mixed website+registry policy change that could be mislabelled as purely registry-driven
  (notification generation now reads Phase 8's own attribution model directly instead of an
  independent, cruder drift check).
- **Separate issues explicitly not created** — every reserved notification type
  (`new_crawler`, `crawler_purpose_change`, `subscription_issue`, `shared_report_expiry`,
  `platform_notice`) and the notification-preferences question were evaluated against real code
  evidence and found not currently authorised or not yet justified, each with its own documented
  re-evaluation trigger (`docs/product/PHASE_10_*_DECISION.md`,
  `NOTIFICATION_TYPE_AND_PRODUCER_MATRIX.md`). No third-party notification channel (email, SMS,
  push, webhook, Slack/Teams/Discord/WhatsApp/Telegram) was added or evaluated for addition — out of
  scope by explicit instruction, not merely deferred.
- **Carried forward, unchanged, from Phase 9** (not addressed by this phase, out of its own scope):
  RISK-001 (real paid Paddle checkout); RISK-006 (notification/analytics/security-event retention,
  recommendation still not implemented — this phase's additive schema changes do not affect that
  open question); RISK-034 (`listDomains()` N+1, still bounded and low-risk).

## Phase 9 update (2026-08-06)

Phase 9 (Agency Workspace and Portfolio Workflows) is **complete** — see
`docs/reports/PHASE_09_AGENCY_WORKSPACE_PORTFOLIO_COMPLETION_REPORT.md`. Same manifest-only
decision carried forward — no live GitHub issue created. When this manifest is applied, create:

- **"Add portfolio workspace and multi-domain workflows"** — already **resolved** by this pass;
  record as closed-on-creation with a link to the completion report and the merge commit, matching
  this repo's established precedent.
- Real content: an authenticated agency/portfolio workspace, an explainable portfolio summary and
  deterministic attention queue, an account-wide cursor-paginated change feed, safe non-empty
  domain-group deletion, a server-side-paginated portfolio table, a genuine CSV file batch-import
  workflow (hand-written RFC 4180 parser, preview/confirm, idempotent), an extended CSV export,
  bounded bulk actions, a persistent Agency-branding profile, and real saved views (wiring up
  previously-unused `saved_filters`/`table_preferences`). Closed RISK-010 (R2 agency-logo orphan
  cleanup) via a new daily-cron category. Found and fixed two real defects along the way: a D1
  bound-parameter limit that would have broken any CSV import over ~14 rows (chunked inserts fix
  it), and a pre-existing accessibility defect (an unlabelled group-rename input) newly caught by a
  Phase 9 a11y scan of a populated groups list.
- **Separate issues explicitly not created** — six decision-gate documents
  (`docs/product/PHASE_09_*_DECISION.md`) each conclude the underlying capability is not currently
  authorised, not merely deferred for later implementation: team roles/invitations (SRS §38
  explicitly places this in post-MVP future scope), a client portal, bulk rescan (no SRS
  authorisation and Phase 11's own capacity evidence argues against it), a multi-domain
  portfolio-report product, and cross-domain policy comparison. Each document records its own
  re-evaluation trigger — revisit only if a future SRS revision authorises the capability.
- **Carried forward, unchanged, from Phase 8** (not addressed by this phase, out of its own scope):
  RISK-028 tagline reconciliation; `package.json` descriptions; the export/report-export
  test-coverage gap; RISK-001 (real paid Paddle checkout); RISK-012 (flaky webhook test);
  `pnpm paddle:catalog:sync`; sandbox Paddle prices; RISK-034 (`listDomains()` N+1, still bounded
  and low-risk — this phase's own new portfolio queries were written N+1-free from the start rather
  than reusing or extending the affected function).

## Phase 8 update (2026-08-06)

Phase 8 (Saved-Domain Experience and Change Timeline) is **complete** — see
`docs/reports/PHASE_08_SAVED_DOMAIN_CHANGE_TIMELINE_COMPLETION_REPORT.md`. Same manifest-only
decision carried forward — no live GitHub issue created. When this manifest is applied, create:

- **"Add a saved-domain policy timeline and change comparison"** — already **resolved** by this
  pass; record as closed-on-creation with a link to the completion report and the merge commit,
  matching this repo's established precedent (see the Phase 7/status-correction entries below).
- Real content: added a deterministic change-attribution model, a materialised policy-change
  timeline (`domain_change_events`), a before/after comparison view, and finding-lifecycle
  classification, all against real D1 tests (32 new integration tests). Found and fixed two real,
  previously-unguarded gaps along the way: no duplicate-simultaneous-scan prevention on manual
  rescans (`domains.scan_lock_until`), and a hardcoded `monitoring: "Not enabled"` bug in the
  reused policy-summary function. Closed messaging-audit items C3 and C5
  (`docs/brand/MESSAGING_SURFACE_INVENTORY.md`).
- **(Carried forward, unchanged, from Phase 7 — not addressed by this phase, whose actual
  execution prompt scoped it to saved-domain experience and change timeline only, not the wider
  objective text in this roadmap's own Phase 8 entry)**: "Reconcile SRS §2.3 Primary Tagline with
  the Phase 2 canonical brand system" (RISK-028); "Add `description` fields to the 10
  `package.json` files that currently lack one"; the export/report-export test-coverage gap
  (`CAPABILITY_MATRIX.md` row 14); plus the unchanged Phase 6-originated items: "Run a real,
  authorized, small-value paid Paddle checkout end to end" (RISK-001); "Fix the flaky
  `billing-webhook.integration.test.ts` concurrent-race test" (RISK-012); "Build
  `pnpm paddle:catalog:sync`"; "Create real sandbox Paddle prices for genuine end-to-end sandbox
  checkout testing".
- **New, found this phase**: "Batch `listDomains()`'s open-findings count into a single query" —
  a pre-existing N+1 query pattern found during Phase 8's own query-architecture review, currently
  bounded and low-risk (see `docs/risks/ACTIVE_RISKS.md` RISK-034), deliberately left unfixed to
  keep this phase's own change surface focused.

## Public Status and Changelog Trust Correction update (2026-08-06)

Same manifest-only decision carried forward — no live GitHub issue created. When this manifest is
applied, create:

- **"Correct public status and changelog trust presentation"** (the recommended title from the
  correction's own prompt) — already **resolved** by this pass; record as closed-on-creation with
  a link to `docs/reports/PUBLIC_STATUS_AND_CHANGELOG_TRUST_CORRECTION_REPORT.md` and the merge
  commit, per this repo's existing precedent for issues opened in the same pass that closes them
  (see the Phase 7 entry below for the same pattern).
- Real content: a stale, unbounded (no time window) failed-webhook count was found live in
  production degrading the public "Billing and checkout" component and overall status based on a
  week-old, already-resolved batch of failures — fixed with a real time-windowed check plus a new
  `publicImpact` gate so an internal-only concern can never again escalate the public page on its
  own. Also removed the trust-reducing uptime-absence sentence and a dead link to the (already
  correctly archived, since Phase 1) `IMPLEMENTATION_STATUS.md` doc. No follow-up issue is
  required — everything this correction found was fixed within the same pass, evidenced by real
  tests against real D1, not deferred.

## Phase 7 update (2026-08-04)

Phase 6 (PR #80, docs-only deployment record PR #81) merged to `main` and deployed to production.
Phase 7 (Vertical Landing Pages and Platform SEO Architecture) is **substantially complete** — see
`docs/reports/PHASE_07_VERTICAL_PLATFORM_SEO_COMPLETION_REPORT.md`. Same manifest-only decision
carried forward. It does **not** close the 6 follow-up issues Phase 6 routed here (tagline
reconciliation, `package.json` descriptions, RISK-001 real paid checkout, the flaky webhook race
test, `pnpm paddle:catalog:sync`, real sandbox Paddle prices) — all six are billing/checkout-area
items, and Phase 7's own execution prompt explicitly prohibited touching pricing, Paddle, checkout,
or crawler-evaluation logic at all. Re-routed below to `phase-08`, not silently dropped. When this
manifest is applied, additionally create these follow-up issues Phase 7 found but deliberately did
not build:

- **"Research and publish the 5 extended platform guides (nginx, apache, fastly, akamai, GitHub
  Pages)"** — Stage 7D, explicitly deferred this session per the phase's own stated permission (the
  official-source research/evidence/uniqueness bar was not attempted, not merely unmet). See
  `docs/risks/ACTIVE_RISKS.md` RISK-031 and `docs/seo/SEO_CONTENT_GOVERNANCE.md`.
- **"Connect a Google Search Console property for crawlpact.com and complete the manual
  verification checklist"** — no property exists yet; see `docs/risks/ACTIVE_RISKS.md` RISK-032 and
  `docs/seo/PHASE_07_SEARCH_PERFORMANCE_BASELINE.md`.
- **"Add a header dropdown/menu for vertical landing pages if the flat 'Platforms' link plus
  homepage/footer coverage proves insufficient for discoverability"** — a deliberately simpler
  design was shipped this phase (see `docs/seo/INTERNAL_LINK_ARCHITECTURE.md`); revisit only if
  real usage data shows a problem, not preemptively.
- **"Investigate and fix the production Lighthouse performance/LCP gap found during Phase 7's
  post-deploy verification"** — a real, pre-existing, site-wide condition (not specific to Phase
  7's new templates), first measured this phase because `deploy-preview.yml` only ever checks the
  preview Worker, never production. See `docs/risks/ACTIVE_RISKS.md` RISK-033.
- **(Carried forward, unchanged, from Phase 6 — routed to `phase-08`)**: "Reconcile SRS §2.3 Primary
  Tagline with the Phase 2 canonical brand system" (RISK-028); "Add `description` fields to the 10
  `package.json` files that currently lack one"; "Run a real, authorized, small-value paid Paddle
  checkout end to end" (RISK-001); "Fix the flaky `billing-webhook.integration.test.ts`
  concurrent-race test" (RISK-012); "Build `pnpm paddle:catalog:sync`"; "Create real sandbox Paddle
  prices for genuine end-to-end sandbox checkout testing".

## Phase 6 update (2026-08-04)

Phase 5 (PR #78, docs-only deployment record PR #79) merged to `main`. Phase 6 (Pricing, Plan
Architecture and Checkout Continuity) is **substantially complete** — see
`docs/reports/PHASE_06_PRICING_PADDLE_CHECKOUT_COMPLETION_REPORT.md`. Same manifest-only decision
carried forward. This closes RISK-016 and RISK-017 (each independently targeted at Phase 6 since
Phase 0's baseline audit — not follow-ups Phase 5 itself routed here): "the dead
`packages/core/src/api/contracts/billing.ts` module" and "the downgrade-labelling UI defect" — both
delivered (RISK-016 closed, RISK-017 mitigated). It does **not** close the two follow-up issues
Phase 5 actually routed here (tagline reconciliation, `package.json` descriptions) — both carried
forward again below, since Phase 6's own execution prompt scoped it to pricing/checkout
specifically. When this manifest is applied, additionally create these follow-up issues Phase 6
found but deliberately did not fix in place:

- **"Reconcile SRS §2.3 Primary Tagline with the Phase 2 canonical brand system"** — carried
  forward unclaimed from Phases 2 through 6, routed to `phase-07`. See
  `docs/risks/ACTIVE_RISKS.md` RISK-028.
- **"Add `description` fields to the 10 `package.json` files that currently lack one"** — same
  carry-forward, routed to `phase-07`.
- **"Run a real, authorized, small-value paid Paddle checkout end to end"** — RISK-001, explicitly
  not attempted this phase without separate authorization; routed to `phase-07` or whichever phase
  is designated for commercial launch readiness.
- **"Fix the flaky `billing-webhook.integration.test.ts` concurrent-race test"** — RISK-012,
  touched but deliberately not fixed this phase (billing-critical ordering logic, needs dedicated
  review); routed to `phase-07`.
- **"Build `pnpm paddle:catalog:sync` (write-capable catalog reconciliation)"** — deliberately not
  built this phase; only the read-only `pnpm paddle:catalog:verify` exists. See
  `docs/billing/PADDLE_CATALOG_RECONCILIATION_RUNBOOK.md`.
- **"Create real sandbox Paddle prices for genuine end-to-end sandbox checkout testing"** — the
  sandbox `plan_prices` rows are placeholder-only (no real sandbox Paddle catalog was created this
  phase); see `docs/billing/PADDLE_CATALOG_RECONCILIATION_RUNBOOK.md`.

## Phase 5 update (2026-08-04)

Phase 4 (PR #72/#73) merged to `main`. Phase 5 (Anonymous Audit Result and Account-Conversion
Flow) is complete — see
`docs/reports/PHASE_05_ANONYMOUS_AUDIT_CONVERSION_COMPLETION_REPORT.md`. Same manifest-only
decision carried forward. This closes the two Phase-4-routed follow-up issues below
("Contextual anonymous-report conversion CTA" and "audit-to-account continuity" — both delivered).
When this manifest is applied, additionally create these follow-up issues Phase 5 found but
deliberately did not fix in place:

- **"Reconcile SRS §2.3 Primary Tagline with the Phase 2 canonical brand system"** — carried
  forward unclaimed from Phases 2, 3, and 4 (Phase 5's execution prompt scoped it to the
  conversion flow specifically, not this backlog item), routed to `phase-06`. See
  `docs/risks/ACTIVE_RISKS.md` RISK-028.
- **"Add `description` fields to the 10 `package.json` files that currently lack one"** — same
  carry-forward, routed to `phase-06`.

## Phase 4 update (2026-08-04)

Phase 3 (PR #71) merged to `main`. Phase 4 (Homepage Information Architecture and Conversion
Redesign) is complete — see
`docs/reports/PHASE_04_HOMEPAGE_CONVERSION_REDESIGN_COMPLETION_REPORT.md`. Same manifest-only
decision carried forward. When this manifest is applied, additionally create these follow-up
issues Phase 4 found but deliberately did not fix in place:

- **"Reconcile SRS §2.3 Primary Tagline with the Phase 2 canonical brand system"** — carried
  forward unclaimed from Phases 2 and 3, routed to `phase-05`. See
  `docs/risks/ACTIVE_RISKS.md` RISK-028.
- **"Add `description` fields to the 10 `package.json` files that currently lack one"** — same
  carry-forward, routed to `phase-05`.
- **"Contextual anonymous-report conversion CTA"** and **"audit-to-account continuity"** — both
  explicitly out of Phase 4's scope, routed to `phase-05`.
- **"Real aggregate proof metrics (audits completed, domains monitored, etc.)"** — deferred until
  a safe, privacy-reviewed methodology exists, routed to `phase-16`.

## Phase 3 update (2026-08-03)

Phase 2 (PR #70) merged to `main`. Phase 3 (Legal Identity, Contact, Security and Trust
Foundation) is complete — see
`docs/reports/PHASE_03_LEGAL_SECURITY_TRUST_COMPLETION_REPORT.md`. Same manifest-only decision
carried forward. When this manifest is applied, additionally create these follow-up issues Phase
3 found but deliberately did not fix in place:

- **"Publish a registered business address, registration number, and tax information"** —
  blocked on product-owner input, routed to `phase-18`. See `docs/risks/ACTIVE_RISKS.md` RISK-011
  and `docs/release/LEGAL_INFORMATION_CHECKLIST.md`.
- **"Reconcile SRS §2.3 Primary Tagline with the Phase 2 canonical brand system"** — carried
  forward unclaimed from Phase 2's routing; neither Phase 2 nor Phase 3 addressed it. Routed to
  `phase-04`. See `docs/risks/ACTIVE_RISKS.md` RISK-028.
- **"Add `description` fields to the 10 `package.json` files that currently lack one"** — same
  carry-forward, routed to `phase-04`.
- **"No purge job for `product_events`/`security_events`/`notifications`"** — routed to
  `phase-11`. See `docs/risks/ACTIVE_RISKS.md` RISK-006.
- **"No cookie-consent mechanism for Google Analytics"** — routed to `phase-13`. See
  `docs/risks/ACTIVE_RISKS.md` RISK-021.
- **"Cloudflare Web Analytics beacon / AI Crawl Control product decision"** — re-routed from
  `phase-03` to `phase-13` (Phase 3's actual scope excludes changing analytics behaviour). See
  `docs/risks/ACTIVE_RISKS.md` RISK-004.

## Phase 2 update (2026-08-03)

Phase 1 (PR #69) merged to `main`. Phase 2 (Brand Positioning and Messaging System) is complete —
see `docs/reports/PHASE_02_BRAND_POSITIONING_MESSAGING_COMPLETION_REPORT.md`. Same manifest-only
decision carried forward — no live milestones/labels/issues created this phase either. When this
manifest is applied, additionally create these follow-up issues Phase 2 found but deliberately did
not fix in place (each labelled with the phase that should own it):

- **"Reconcile SRS §2.3 Primary Tagline with the Phase 2 canonical brand system"** — routed to
  `phase-03`. See `docs/risks/ACTIVE_RISKS.md` RISK-028 and
  `docs/brand/MESSAGING_SURFACE_INVENTORY.md` row E1.
- **"Add `description` fields to the 10 `package.json` files that currently lack one"** — low
  priority, routed to `phase-03`. See `docs/brand/MESSAGING_SURFACE_INVENTORY.md` row B8.
- **"Reuse `AuditReportView.tsx`'s `STATUS_LABEL`/`STATUS_TONE` maps in the authenticated
  domain-detail scan-history list instead of raw status-enum text"** — routed to `phase-08`. See
  `docs/brand/MESSAGING_SURFACE_INVENTORY.md` row C3.
- **"Add a customer-facing change-timeline UI surfacing `scan_diffs`/`diffType`"** — routed to
  `phase-08`. See `docs/brand/MESSAGING_SURFACE_INVENTORY.md` row C5.
- **"Apply the recommended GitHub repository description and topics"** — see
  `docs/brand/GITHUB_BRAND_METADATA_MANIFEST.md` for the exact values and command.

## Phase 1 update (2026-08-03)

Phase 0 (PR #68) merged to `main` as `1a39d29`. Phase 1 (Repository Documentation and
Source-of-Truth Correction) is complete — see
`docs/reports/PHASE_01_DOCUMENTATION_SOURCE_OF_TRUTH_COMPLETION_REPORT.md`. Still no live
milestones/labels/issues created (same manifest-only decision carried forward). When this manifest
is applied, additionally create these follow-up issues Phase 1 found but did not fix in place
(each labelled `documentation`, `priority-p2`, and the phase that should own it):

- **"Stale contract-vs-endpoint table in docs/api/API_CONTRACTS.md"** — `phase-01` follow-up,
  routed to whichever future pass owns `packages/core` contract cleanup.
- **"docs/deployment/ENVIRONMENTS.md's deploy-mechanism column says 'manual', stale vs. GitHub
  Actions (ADR-0007)"** — routed to `phase-12`.
- **"docs/operations/INCIDENT_RESPONSE.md's 'no incidents recorded, nothing deployed' claim is
  stale since production went live 2026-07-26"** — routed to `phase-14`.
- **"docs/seo/ROUTE_REGISTRY.md's canonical-redirects section says 'not yet implemented, no
  Cloudflare account connected' — confirmed live and working since 2026-07-27"** — routed to
  `phase-07`.
- **"docs/seo/EDITORIAL_SOURCE_AND_CONTENT_POLICY.md cites the legal-information checklist at the
  wrong path (docs/status/ instead of docs/release/)"** — routed to `phase-03`.

These five items are recorded in `docs/governance/DOCUMENTATION_INVENTORY.md` with `NEW:` findings
and were deliberately not fixed in the same Phase 1 pass that fixed the 15 Phase-0-tracked
conflicts plus the higher-severity R2/crawler-count/failure-condition-triggering findings, to keep
Phase 1's scope bounded and each fix independently verifiable.

GitHub write access (milestones, labels, issues) was available this session via the `gh` CLI and
GitHub MCP tools (confirmed working — used read-only for `gh run list`/`gh api` checks during this
audit). Per the user's explicit instruction at the start of this Phase 0 run, no live milestones,
labels, or issues were created — this manifest instead records exactly what should be created,
so it can be applied later either by running the commands below or by a future session once
authorized.

## Milestones to create

```bash
gh api repos/rmtlbandara/CrawlPact/milestones -f title="Foundation and Trust" -f state="open"
gh api repos/rmtlbandara/CrawlPact/milestones -f title="Conversion and Monetisation" -f state="open"
gh api repos/rmtlbandara/CrawlPact/milestones -f title="Product Value" -f state="open"
gh api repos/rmtlbandara/CrawlPact/milestones -f title="Infrastructure and Reliability" -f state="open"
gh api repos/rmtlbandara/CrawlPact/milestones -f title="SEO and Market Authority" -f state="open"
gh api repos/rmtlbandara/CrawlPact/milestones -f title="Customer Validation" -f state="open"
gh api repos/rmtlbandara/CrawlPact/milestones -f title="Launch Readiness and Continuous Governance" -f state="open"
```

Each command is idempotent in effect (re-running against an existing title will create a
duplicate — check `gh api repos/rmtlbandara/CrawlPact/milestones` first and skip any title that
already exists before applying).

## Labels to create

```bash
# Priority
gh label create priority-p0 --color B60205 --description "Launch-blocking or critical" -R rmtlbandara/CrawlPact
gh label create priority-p1 --color D93F0B --description "High priority, not launch-blocking" -R rmtlbandara/CrawlPact
gh label create priority-p2 --color FBCA04 --description "Normal priority" -R rmtlbandara/CrawlPact

# Workstream
gh label create brand --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create conversion --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create product --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create website --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create infrastructure --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create database --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create security --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create billing --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create seo --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create documentation --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create analytics --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create legal --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create operations --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create registry --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create accessibility --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create customer-validation --color C5DEF5 -R rmtlbandara/CrawlPact

# Status
gh label create blocked --color 000000 -R rmtlbandara/CrawlPact
gh label create needs-validation --color 000000 -R rmtlbandara/CrawlPact
gh label create accepted-risk --color 000000 -R rmtlbandara/CrawlPact

# Phase
gh label create phase-00 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-01 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-02 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-03 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-04 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-05 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-06 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-07 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-08 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-09 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-10 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-11 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-12 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-13 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-14 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-15 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-16 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-17 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-18 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-19 --color 5319E7 -R rmtlbandara/CrawlPact
```

Note: `gh label create` errors (not silently skips) if a label with that name already exists — a
future run should check `gh label list -R rmtlbandara/CrawlPact` first, or use
`gh label create ... --force` to overwrite the color/description of an existing label.

## Issues to create

### One umbrella issue

**Title**: `CrawlPact Improvement Programme — Phases 0–19 (umbrella)`
**Labels**: `priority-p1`
**Body**:

```markdown
Tracks the full CrawlPact improvement programme established by the Phase 0 baseline audit
(2026-08-03). See docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md for the phase index,
dependencies, and release gates, and docs/baseline/2026-08-03/ for the evidence baseline every
later phase must be consistent with.

Phase issues: link each phase-NN issue here as it is created.

This issue is never "closed" in the normal sense — it tracks programme completion through
Phase 19 (ongoing governance).
```

### One issue per phase (Phase 0 through Phase 19)

Each phase issue uses this template, with `{N}`, `{NAME}`, `{OBJECTIVE}`, `{DELIVERABLES}` filled
from `docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md`'s phase index:

**Title**: `Phase {N} — {NAME}`
**Labels**: `phase-{NN}`, plus the relevant workstream label(s)
**Body**:

```markdown
## Objective

{OBJECTIVE}

## Scope

See docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md#phase-{n} for full scope.

## Dependencies

{DEPENDENCIES}

## Required deliverables

{DELIVERABLES}

## Acceptance criteria

{COMPLETION GATE, from the roadmap}

## Out of scope

Anything not explicitly listed above; anything reserved for a later phase per the roadmap's
phase boundaries.

## Completion report requirement

This phase is not complete until a completion report is written summarizing what changed, what
was tested, what risks were found/resolved, and confirming no out-of-scope change was made.

## Links

- Baseline: docs/baseline/2026-08-03/PHASE_0_BASELINE_REPORT.md
- Roadmap: docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md
- Umbrella issue: #{umbrella-issue-number}
```

20 such issues (Phase 0 → Phase 19) should be created, each linked back to the umbrella issue.

### One issue per newly discovered actionable P0 risk

No new **P0** risk was found during this Phase 0 baseline (see
`docs/baseline/2026-08-03/BASELINE_RISKS_AND_UNKNOWNS.md` — the highest severities found this
session were P1: DC-004, DC-005, DC-006, R-003, R-005, R-011). Per the phase's own instruction, a
dedicated issue is only required for P0 risks; the P1 items above are recommended for tracking via
the phase issues that own their topic (Phase 1 for the documentation-conflict P1s, Phase 11 for
R-005, Phase 13 for R-011, Phase 15 for R-003) rather than as standalone issues, since none is
independently actionable outside its owning phase's scope.

## Idempotency note

Before running any of the above, check `gh issue list -R rmtlbandara/CrawlPact --search "Phase 0
in:title"` (and similarly for the umbrella issue's title) to avoid creating duplicates if a
previous session already created some of these.
