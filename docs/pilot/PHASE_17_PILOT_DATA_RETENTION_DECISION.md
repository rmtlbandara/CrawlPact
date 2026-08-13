# Phase 17 Pilot Data Retention Decision

Status: current-authoritative.

## Decision

No separate owner-approved retention period was sought or obtained this session for pilot
feedback free text. Per §107 ("If Retention Is Not Approved"), the conservative default is
applied: minimise what free text is stored, and record the decision blocker honestly rather than
invent a legal retention period.

| Data                                                                           | Retention                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pilot_cohorts` / `pilot_participants` (structured cohort/participation state) | Retained indefinitely as aggregate evidence, mirroring how other structured product-analytics facts (e.g. `product_events`) are retained — no PII beyond a `user_id` reference.                                                        |
| `pilot_feedback` structured fields (category/usefulness/clarity/etc. enums)    | Retained indefinitely — these are aggregate-safe, contain no free text.                                                                                                                                                                |
| `pilot_feedback.comment` (optional free text)                                  | **Purged after 18 months**, via the existing `packages/database` retention job, mirroring Phase 13's `product_events` retention window precedent exactly (same job pattern, same duration) — see `apps/web/src/lib/data-retention.ts`. |
| Interview notes (manual, owner-led)                                            | Never stored as full transcripts in this repository (§84) — only structured coded findings per `docs/pilot/PILOT_FEEDBACK_CODING_SCHEMA.md`.                                                                                           |

## Why 18 months, not a fresh decision

Rather than invent a new retention period without owner sign-off, this phase reuses the
**already-approved** Phase 13 `product_events` retention window as the closest existing
precedent for "bounded, non-permanent first-party behavioural/feedback data." If the owner later
wants a different pilot-specific window, that is a small, isolated change to one purge query —
not a blocker to shipping the pilot framework itself.

## Account deletion interaction (§108, §176-177)

A participant's normal account-deletion lifecycle is unaffected by pilot participation — see
`docs/pilot/PHASE_17_PILOT_DATA_MODEL_DECISION.md`'s FK policy. When an account is deleted, all
three pilot tables cascade-delete for that user automatically; no separate pilot-specific deletion
step is needed, and pilot cohort membership never blocks the deletion flow.

## Implementation status

Implemented this session: `purgeExpiredPilotFeedbackComments` (a new `expired_pilot_feedback_comments`
category in `apps/web/src/lib/data-retention.ts`'s existing daily retention job) nulls
`pilot_feedback.comment` for rows older than 548 days (18 months), leaving the structured fields
and the cohort/participant relationship intact. It runs automatically alongside every other
retention category — no separate cron trigger, no separate operational surface. Verified by
integration test (`retention-pilot-feedback-comments` scenario).
