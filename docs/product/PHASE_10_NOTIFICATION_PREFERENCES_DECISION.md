# Phase 10 — Notification Preferences Decision

## Question

Should Phase 10 build a fine-grained, server-stored notification-preference system (per-category
or per-type opt-out)?

## Findings

- No SRS requirement or prior-phase document (Phase 8, Phase 9, Phase 11) mentions user-configurable
  notification preferences. `apps/web/src/pages/api/notifications/` has no preference route today.
- The schema has no `notification_preferences` table, and none of Phase 10's own required work
  (dedupe, failure isolation, reconciliation, Atom hardening) depends on one existing.
- The two approved Phase 10 channels already give a user two coarse, real levers: the in-app
  centre's category/domain/group filters (this phase, for _reviewing_ history) and the Atom
  token's create/revoke (an all-or-nothing channel toggle, already existed).

## Decision

**A fine-grained preference system is not authorised and is not implemented in Phase 10.**

Neither condition for proceeding is met: no requirement calls for it, and building one is
significant new scope unrelated to this phase's actual chartered purpose (reliability of the two
existing channels). Building a large preference system this phase's own instructions explicitly
warn against when requirements are incomplete.

## What is provided instead

- In-app centre filtering (unread/category/domain/group) — reviewing, not suppressing.
- Atom feed enable/revoke — an existing all-or-nothing channel-level toggle.
- The fatigue policy itself (`NOTIFICATION_FATIGUE_AND_GROUPING_POLICY.md`) already suppresses
  low-signal events at the source, so most of what a preference system would exist to prevent
  (noise) is handled deterministically instead of per-user configuration.

## Re-evaluation trigger

Revisit if a future SRS revision explicitly calls for user-configurable notification preferences,
with: server-side storage, clear defaults, documented future-event behaviour, critical
account/service notices handled separately from any suppressible category, no client-side-only
suppression, and an explicit statement that a preference can never disable the underlying
monitoring job itself.
