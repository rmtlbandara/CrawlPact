---
Document owner: Engineering owner
Status: current-authoritative
Last verified: 2026-08-11
---

# Registry Versioning Policy

## Convention

`YYYY.MM.N` — calendar year, calendar month, and a sequence number reset each month. This matches
the existing history (`2026.07.1` through `2026.07.3`) and is not changed by Phase 15 (Section
36 explicitly warns against inventing a new scheme without justification; the existing convention
has no structural problem that would require one).

## Choosing the next label

The next label is derived from the **actual current date** at publication time, not from an
example a historical document happened to suggest. A prior document mentioned `2026.07.4` as an
illustrative next label for the pending Amazon/Google correction — that label is stale by the time
Phase 15 actually publishes, since real time has passed. The correct next label for a release
published in August 2026 is `2026.08.1` (the first release of that calendar month), not
`2026.07.4`. See the Phase 15 completion report for the exact label actually used, chosen at
publication time.

## Uniqueness

`registry_versions.version_label` already carries a `UNIQUE` SQL constraint
(`packages/database/migrations/0004_registry.sql:42`) and a matching Drizzle-level expectation. A
duplicate label fails at the database layer with a constraint violation, which
`createRegistryRelease` surfaces as a real error rather than silently overwriting. This was
already correct pre-Phase-15 — verified, not newly built.

## Release-entry uniqueness

`registry_version_entries` already carries `UNIQUE (registry_version_id, crawler_id)`
(migration 0004:54) — one crawler can appear at most once per release. Also already correct,
verified rather than newly built.

## Ruleset versions

`ruleset_versions.version_label` also already carries `UNIQUE` (migration 0004:61) — verified,
not newly built. Rulesets are otherwise out of this phase's scope (the prompt explicitly
prohibits altering ruleset semantics as part of ordinary registry maintenance); the one ruleset
change this phase made was the unrelated activation-atomicity fix (see
`docs/registry/PHASE_15_REGISTRY_BASELINE.md`).
