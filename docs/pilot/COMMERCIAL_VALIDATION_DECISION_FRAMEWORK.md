# Commercial Validation Decision Framework

Status: current-authoritative. Defines the four possible outcomes of pilot analysis (§112-116).
The decision itself always remains an explicit owner decision — this framework never computes
`commercially_validated = true` from a formula (§117).

## Outcome A — Validated enough to proceed

Use only when **all** of: the pre-registered evidence floor is reached
(`docs/pilot/PHASE_17_SUCCESS_CRITERIA.md`), core activation works, real external paid
conversion exists, no unresolved P0/P1 blocker remains, the primary commercial audience
(agency/multi-site) demonstrates real value, support burden is manageable, and recurring value
has at least directional real evidence. This does **not** mean full product-market fit.

## Outcome B — Conditionally validated

Strong evidence exists, but one or more narrow launch conditions remain (e.g. an onboarding copy
issue, one billing lifecycle gap, incomplete full-month Solo observation). The exact condition(s)
become explicit Phase 18 gates.

## Outcome C — Insufficient evidence

Too few qualified participants, too short an observation window, no real purchase decisions, or
most activity was internal. This is **not** a failure verdict — it means the pilot needs to
continue, not that CrawlPact has failed commercially.

## Outcome D — Not commercially validated

Sufficiently qualified evidence shows the problem isn't valuable, users consistently fail to
understand the product, users reach value but won't pay the existing price, or the primary
audience doesn't value monitoring/agency workflows. This result must never be hidden if the real
evidence supports it.

## Current status

As of this phase's technical-readiness checkpoint (2026-08-11): **Outcome C (insufficient
evidence)** by definition — external participant count is `0`. No commercial-validation decision
can honestly be made yet. See `docs/pilot/PHASE_17_PILOT_READY_AWAITING_EXTERNAL_EVIDENCE.md`.
