# Pilot Support Burden Measurement

Status: current-authoritative.

## Goal (§78)

Test whether CrawlPact can operate with very low human support. Do not solve pilot friction by
introducing live chat, a support-desk SaaS, or onboarding calls as a permanent dependency —
solving friction discovered during the pilot means improving the product's self-service copy/UX,
not adding a human layer around it (§80).

## What counts as a "meaningful human intervention" (§79)

- Explaining what to click.
- Manually fixing a participant's setup.
- Interpreting basic report output for them.
- Manually enabling product state on their behalf.

## What does NOT count

- The recruitment conversation itself.
- An optional research interview.

## Measurement mechanism

Recorded via the existing Super Admin pilot workspace:

- `pilot_participants.human_help_count` — a simple integer, incremented once per meaningful
  intervention via `POST /api/admin/pilots/:cohortId/participants/:participantId/human-help`.
- The narrative for each intervention (what was needed, category, whether documentation could
  have resolved it) is recorded via the existing internal admin-note mechanism
  (`internal_user_notes`, prefixed `[Pilot support]`), not a new free-text table — see
  `docs/pilot/PHASE_17_PILOT_DATA_MODEL_DECISION.md`.

## Reporting

At analysis time, report:

```text
participants needing any help / total participants
total interventions
most common intervention categories
which of those were resolved by a subsequent copy/UX/documentation fix (self-service improvement)
```

Always with real counts and denominators — never a bare percentage for a small cohort (§68).
