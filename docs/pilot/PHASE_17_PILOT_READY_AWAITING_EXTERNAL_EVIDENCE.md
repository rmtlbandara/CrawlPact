# Phase 17 Pilot Ready — Awaiting External Evidence

Status: current-authoritative checkpoint. This document exists because the Phase 17 prompt
explicitly requires it (§229 area): when only technical pilot-readiness is complete — no real
external participants yet — the phase must stop here honestly rather than claim commercial
validation. **Phase 17 is technically ready but not commercially complete.**

## Why this document exists instead of a completion report

Phase 17's own framing (§1–§9) is explicit: this is not primarily a feature-development phase, it
is an evidence-generation phase. Its central question — do real external users understand
CrawlPact, reach value without help, return for monitoring, and voluntarily pay the existing
public price — cannot be answered by an autonomous coding agent. Recruiting real pilot
participants is a manual, one-to-one action that belongs to the human product owner
(`docs/pilot/PHASE_17_PARTICIPANT_QUALIFICATION.md` §26/§194). No synthetic test, internal usage,
or owner opinion may substitute for that evidence (§9/§19/§24). Because 0 real external
participants exist as of this checkpoint, `docs/reports/PHASE_17_CUSTOMER_PILOT_AND_COMMERCIAL_
VALIDATION_COMPLETION_REPORT.md` is deliberately **not** created — creating it now, before real
evidence exists, would itself be the fabrication this project's rules forbid (CLAUDE.md: "Never
present mocked, fabricated, or synthetic data as a real product outcome").

## What is ready (technical readiness — complete)

- **Data model**: `pilot_cohorts` / `pilot_participants` / `pilot_feedback` (migration `0036`),
  deliberately minimal — no invite-token table (no email column exists anywhere in this codebase;
  auth is passkey/WebAuthn-only), no separate intervention table (a `human_help_count` counter plus
  reuse of the existing internal-notes mechanism suffices). See
  `docs/pilot/PHASE_17_PILOT_DATA_MODEL_DECISION.md`.
- **Super Admin workspace** (`/admin/pilots`): create/manage cohorts, associate/remove
  participants, change participation status, record human-help interventions, view feedback — all
  built on the pre-existing `/api/admin/users` lookup (id-based, no email needed).
- **Live metrics** (`getPilotCohortMetrics`): activation, monitoring-enabled, and paid-conversion
  ratios computed directly from `domains` / `subscriptions` / `billing_customers` — the same query
  shapes Phase 13's product analytics already use, never a duplicated pilot-specific field. See
  `docs/pilot/PHASE_17_COMMERCIAL_METRIC_DICTIONARY.md`.
- **In-app feedback capture**: `PilotFeedbackLink` (mounted in `AppNav.astro`) and
  `POST /api/app/pilot/feedback`, ownership-checked so a participant can only submit feedback for
  their own participation record.
- **No entitlement coupling**: structurally verified — no plan/subscription/domain-count column
  exists anywhere in the new schema, confirmed by `pilot-validate.mjs` and a dedicated integration
  test (`pilot.integration.test.ts`: "adding a participant never changes their plan").
- **Data retention**: pilot-feedback comments purged after the same 548-day window already
  approved for `product_events` (Phase 13); structured fields and relationships survive as
  aggregate-safe evidence indefinitely.
- **Governance documents** (all under `docs/pilot/`, `docs/product/`, `docs/security/`,
  `docs/data/`, `docs/operations/`): pre-registered hypotheses, frozen success criteria,
  participant qualification rules, change-control policy, commercial-validation decision
  framework, security/privacy threat review, query/index audit, reliability review — see
  `docs/governance/DOCUMENTATION_INVENTORY.md` for the complete list.
- **Tests**: 11 integration test cases (`pilot.integration.test.ts`) plus one new data-retention
  case, all passing against real D1. `pnpm pilot:validate` wired into `quality:gate`, CI, and
  `verify:push`.

## What is NOT ready / not done (and must not be claimed as done)

- **Zero real external pilot participants** have been recruited. `pilot_cohorts` and
  `pilot_participants` are empty in production.
- **Zero real external paying customers** exist. Two real, live production Paddle subscriptions
  were found and independently re-verified this phase, but both belong to the product owner's own
  Super Admin account — explicitly excluded from commercial evidence per
  `docs/pilot/PHASE_17_PARTICIPANT_QUALIFICATION.md` §24. This closes RISK-001's _technical_
  sub-question (a real checkout → payment → webhook → plan-grant chain has now been directly
  observed — see `docs/pilot/REAL_PAID_CHECKOUT_VALIDATION_PROTOCOL.md`) but provides zero
  commercial-validation evidence.
- **No hypothesis in `docs/pilot/PHASE_17_PILOT_HYPOTHESES.md` has been tested.**
- **The commercial-validation verdict is `docs/pilot/PHASE_17_COMMERCIAL_VALIDATION_DECISION.md`:
  Outcome C — insufficient evidence.** This is the honest, correct verdict at 0 participants, not
  a placeholder to be quietly overwritten later without an amendment trail.
- **No observation window has begun** (`docs/pilot/PHASE_17_SUCCESS_CRITERIA.md` requires a
  minimum 14, preferably 30, day window once real participants are active).

## What the product owner needs to do next

1. **Recruit real external participants** manually, one at a time, per
   `docs/pilot/PHASE_17_PARTICIPANT_QUALIFICATION.md` — target the evidence floor in
   `docs/pilot/PHASE_17_SUCCESS_CRITERIA.md` (>= 8 participants, >= 4 from the agency/multi-site
   segment, >= 2 independent real paying customers). Weight recruitment toward agency/multi-site
   operators, CrawlPact's primary commercial segment.
2. **Add each participant** via `/admin/pilots` (looked up by existing account, id-based — no
   email/invite infrastructure exists or is needed).
3. **Share `docs/pilot/PILOT_PARTICIPANT_NOTICE.md`** with each participant before they start.
4. **Observe** using `docs/pilot/PILOT_TASK_SCRIPT.md` (owner-led, in person/call/recording) and
   collect structured feedback via the in-app `PilotFeedbackLink` and, where useful,
   `docs/pilot/PILOT_INTERVIEW_GUIDE.md` (manual interviews, non-leading questions).
5. **Record human-help interventions** honestly in `/admin/pilots` whenever the owner has to step
   in — this is a first-class signal, not something to under-report.
6. **Let the observation window run** (minimum 14 days) before drawing conclusions — no early
   stopping on a promising first few days (anti-hindsight-bias discipline, §118).
7. **Bring the evidence back to a future session.** At that point, a future pass will: refresh
   `docs/pilot/PHASE_17_COMMERCIAL_VALIDATION_DECISION.md` with the real outcome (recording any
   threshold amendment per `docs/pilot/PHASE_17_SUCCESS_CRITERIA.md`'s amendment policy, never
   silently), and — only if the evidence floor is genuinely met — produce
   `docs/reports/PHASE_17_CUSTOMER_PILOT_AND_COMMERCIAL_VALIDATION_COMPLETION_REPORT.md` for the
   first time.

## What must NOT happen automatically

Per the Phase 17 prompt's own doctrine, deploying this technical infrastructure to production is
**not** an authorization to begin recruitment, and code-deployment approval and
research/pilot-activation approval are always two separate decisions, never inferred from each
other. Recruitment begins only when the product owner explicitly decides to begin it.

## Metrics that will be evaluated once real evidence exists

See `docs/pilot/PHASE_17_SUCCESS_CRITERIA.md` for the frozen thresholds and
`docs/pilot/PHASE_17_COMMERCIAL_METRIC_DICTIONARY.md` for exact numerator/denominator definitions
of: activation rate, monitoring-enabled rate, paid-conversion rate, core-audit-completion-without-
help rate, human-intervention rate, and independent real paying customer count.
