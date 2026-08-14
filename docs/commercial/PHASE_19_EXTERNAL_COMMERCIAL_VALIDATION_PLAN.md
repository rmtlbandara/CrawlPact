# Phase 19 External Commercial Validation Plan

Status: current-authoritative, 2026-08-14. Phase 19 owns closing the commercial-validation
question the Phase 17/18 governance deferral deliberately left open
(`docs/pilot/PHASE_17_OWNER_APPROVED_COMMERCIAL_VALIDATION_DEFERRAL.md`). Unlike that deferral,
this question **cannot be closed by governance decision** — only by real evidence. It may
legitimately remain "insufficient evidence" indefinitely until that evidence exists.

## Frozen criteria (unchanged, cross-referenced not duplicated)

See `docs/pilot/PHASE_17_SUCCESS_CRITERIA.md` for the full frozen evidence floor (external
participants ≥ 8, agency/multi-site ≥ 4, core audit completion ≥ 75%, saved-baseline activation ≥
60%, end-to-end journey without major intervention ≥ 70%, independent external paying customers ≥
2, unresolved P0/P1 = 0, minimum observation 14 days/preferred 30). These are not restated here to
avoid duplicate tables drifting out of sync — this document only tracks _progress against_ them.

## What counts as evidence (unchanged from Phase 17/19 prompt rules)

- **Does not count**: owner accounts, internal/team accounts, synthetic accounts, reimbursed
  purchases, complimentary access.
- **Does count**: recruited pilot participants (via `pilot_cohorts`/`pilot_participants`) _and_
  organic external customers who discover and pay for CrawlPact independently — tracked
  separately, not merged into one number.

## Current state (2026-08-14)

| Evidence type                               | Count |
| ------------------------------------------- | ----- |
| Recruited pilot participants                | 0     |
| Organic external paying customers           | 0     |
| Total independent external paying customers | 0     |

## Operating plan

1. **Recruitment remains manual** (§14) — the product owner personally identifies and invites
   candidates. No automation (cold-email, scraping, CRM, social outreach) is built or used for
   this. This document does not perform recruitment; it defines how evidence is captured and
   evaluated once recruitment happens.
2. **Use existing Phase 17 infrastructure** — `pilot_cohorts`, `pilot_participants`,
   `pilot_feedback`, `/admin/pilots`, and its existing activation/monitoring/paid-conversion
   metrics. No new pilot system is built.
3. **Track the funnel** per participant: qualified → audit started → audit completed → value
   understood → account created → saved baseline → monitoring enabled → returned → pricing
   viewed → checkout started → paid → retained. Always reported as count/denominator with
   percentages, never a bare count.
4. **Organic customers** are logged the same way but flagged `source: organic`, kept in a
   separate column from recruited-pilot evidence, per §13.
5. **Observation window**: 14 days minimum, 30 days preferred, per participant, before their data
   is used in a floor-threshold evaluation.

## Decision states

Report progress using exactly one of:

- `VALIDATED ENOUGH TO CONTINUE`
- `PROMISING — MORE EVIDENCE REQUIRED`
- `INSUFFICIENT EVIDENCE`
- `NOT VALIDATED`

**Current state: `INSUFFICIENT EVIDENCE`** — 0 external participants, 0 external paying customers,
no observation window has started. This is not a failure; it is an honest starting point.

## When sufficient evidence exists

Create `docs/reports/PHASE_19_EXTERNAL_COMMERCIAL_VALIDATION_REPORT.md`, cross-referencing (not
rewriting) the Phase 17 deferral. Do not claim "product-market fit" even if the frozen floor is
passed — use `commercial validation achieved`, `directional commercial evidence`, or `early
market signal` as the evidence actually supports (§17).

## Next action

Product owner: begin manual recruitment of pilot candidates per the existing Phase 17
infrastructure. No further code or documentation work is blocking this — the infrastructure and
measurement plan already exist.
