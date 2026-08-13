# Phase 17 Change Control Policy

Status: current-authoritative.

## Principle

Phase 17 must not become "build everything customers request" (§88). Only issues required to
_safely validate the existing product_ are fixed during the pilot itself; everything else is
routed to a later phase.

## Decision record format

For every change requested during an active pilot, record:

| Field        | Meaning                                                                                |
| ------------ | -------------------------------------------------------------------------------------- |
| Evidence     | What was observed (participant label, task, exact friction)                            |
| Severity     | P0 / P1 / P2 / P3 / feature request (`docs/pilot/PILOT_FEEDBACK_CODING_SCHEMA.md`)     |
| Frequency    | One participant (data point) vs. repeated independent participants (pattern)           |
| Pilot impact | Does this block continuing recruitment, or just note-worthy?                           |
| Decision     | Fix now / fix narrowly / defer / decline                                               |
| Target phase | This phase (P0/narrow P1 only), Phase 18 (launch-blocking), or Phase 19 (optimisation) |

## Response by severity

- **P0** (security/data/billing integrity): fix immediately; pause further pilot recruitment
  until resolved.
- **P1** (core commercial journey blocked): may be fixed within Phase 17 if narrow.
- **P2** (repeated major usability/value friction): evaluate a narrow fix only if the pattern is
  real (≥2 independent participants).
- **P3** / feature request: record only, route to Phase 19 unless truly launch-blocking.

## Pilot stability (§138-139)

Avoid major product changes mid-cohort — participants testing materially different products
produce non-comparable evidence. If a critical change is genuinely required during an active
cohort:

1. Record the deployment date and commit.
2. Record which participants joined before vs. after the change.
3. Keep pre/post evidence separate in analysis — never blend them into one number.

Every cohort also records its **starting** product commit/deployment and the current plan-catalog/
Paddle-price configuration at the moment recruitment begins (§139-140) — not per click, just once
per cohort, as a version marker in the cohort's `description` field or an accompanying admin note.

## Change log

None yet — no active pilot cohort exists as of this phase's technical-readiness checkpoint.
