# Phase 8 — Policy Objective Decision Gate

## Question

The Phase 8 prompt permits a "minimal domain-level policy objective" model _only_ when authorised
by current requirements, and explicitly warns against inventing one casually.

## Finding

A full-text search of `docs/product/CRAWLPACT_FINAL_SRS.md` for "policy objective" returns zero
matches. What the SRS does authorize, at §18 "Policy Presets" and §25 "Saved Domains and
Monitoring", is per-domain selection among **four fixed presets** — Maximum AI Visibility, Allow
Search Block Training, Publisher Protection, Block Known AI Crawlers — already implemented in
`packages/policy/src/presets.ts` and already wired into `domains.preset`
(`packages/database/src/schema/domains-scans.ts:29-36`), `updateDomain()`
(`apps/web/src/lib/domains.ts:177-210`), and `DomainDetailActions.tsx`'s preset `Select`.

FR-POL-002/003/004 (SRS §18) require: the selected preset influences finding severity, score, and
recommendations; changing a preset never modifies the customer's website; **preset changes shall
be recorded in account history** — i.e. exactly the kind of event the Phase 8 timeline exists to
show.

SRS §38 "Future Scope" explicitly lists "Custom policy matrices" as something to consider "only
after paid-market validation" — out of current-phase scope, not deferred-but-implied.

`docs/brand/PRODUCT_TERMINOLOGY_GLOSSARY.md`'s own definition of "Objective" ties the concept to
the _account's_ selected preset, not a new bespoke per-domain object.

## Decision

**Not authorised.** No new policy-objective concept, model, or preset builder is introduced in
Phase 8. The existing 4-preset selection already satisfies the spirit of a "domain-level policy
objective" and is already implemented — Phase 8's job is to surface **preset changes** as a
first-class `operational` event type in the change timeline (§20/§23 of the Phase 8 prompt), not
to build a second, competing objective system.

Concretely, this phase:

- Adds a `preset_changed` timeline event (`domain_change_events.event_type = "operational"`,
  `change_origin = "operational"`) generated from `updateDomain()` when `preset` changes,
  satisfying FR-POL-004's "recorded in account history" requirement, which had no timeline surface
  before this phase.
- Does **not** add a "custom objective" selector, does not add preset presets-of-presets, and does
  not change preset semantics, recommendation generation, or score calculation in any way.
- Where the Phase 8 prompt's UI copy suggests "No policy objective selected" for the
  not-authorised case, this phase instead uses the domain's real, already-existing preset name —
  there is no unauthorised gap to paper over, since a preset is always selected by definition
  (`createDomain()` defaults to `maximum_ai_visibility` when none is supplied).
