# Phase 10 — New Crawler Notification Decision

## Question

Should `new_crawler` (and, closely related, `crawler_purpose_change`) gain a real producer in
Phase 10?

## Findings

- Neither type has ever had a producer (`NOTIFICATION_TYPE_AND_PRODUCER_MATRIX.md`) — this is not a
  regression, it is the starting state.
- The registry-governance system that publishes new crawler entries and classification changes
  (`packages/database/src/schema/registry.ts`, `apps/web/src/lib/registry-data.ts`,
  `docs/registry/CRAWLER_REGISTRY_GOVERNANCE.md`) is explicitly out of Phase 10's scope — SRS
  registry-publication governance and its public changelog belong to Phase 15
  (`docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md`).
- Phase 10's own fatigue policy (§18) is explicit: "Do not globally notify every user every time a
  crawler registry release is published... A registry notification should generally require that
  the registry update materially affects one of the user's saved domains." The existing
  `registry_drift` producer already satisfies this correctly-scoped case (fires only when a real
  scan comparison shows the registry version changed AND the domain's own evaluation crossed the
  `high_attention` threshold). A separate `new_crawler`/`crawler_purpose_change` producer would
  either (a) duplicate that already-correct domain-impact check, or (b) fire account-wide on every
  registry release regardless of domain impact — exactly the notification-storm anti-pattern §93
  lists as a Phase 10 failure condition.

## Decision

**`new_crawler` and `crawler_purpose_change` remain reserved — no producer added in Phase 10.**

The domain-impact-specific case they might otherwise serve is already correctly covered by
`registry_drift`. A separate, less-precise producer would only add risk (either duplicated logic or
notification-storm risk) without adding real user value.

## Public claims

No public-facing copy (marketing pages, in-app empty states, help text) claims these types
currently fire — confirmed by grep across `apps/web/src/pages` and `apps/web/src/content` for
`new_crawler`/`crawler_purpose_change`; the only references are the schema/API-contract enum
declarations and this document. No removal of any existing claim was necessary.

## Re-evaluation trigger

Revisit only alongside Phase 15's registry-publication and governance work, if that phase's own
scope determines a genuinely new (not `registry_drift`-duplicating) domain-impact case exists for a
newly-verified crawler specifically, as distinct from any other registry-driven change.
