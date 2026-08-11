---
Document owner: Engineering owner
Status: current-authoritative
Last verified: 2026-08-11
---

# Phase 15 — Registry Baseline

Starting-state facts recorded at the beginning of Phase 15 (2026-08-11), verified against the
actual code and database rather than assumed from prior documentation.

## Starting state

- **Repository commit**: `6b0dc3c7bda47fe2ec4f45b911e48f32f97606a9` (main, post-Phase-14
  deployment record).
- **Production Worker**: `087236e1-35fe-477d-a370-d226a4a67fbe`.
- **Migration state**: `0033_scheduled_job_runs_started_at_index.sql` (33/33 applied).
- **Active registry version**: `2026.07.3` (23 crawlers, 9 operators, all `lifecycle_status =
'active'`).
- **Public crawler pages**: 22 of 23 registered crawlers have a dedicated Markdown reference page;
  Bingbot does not (disclosed reason: its official source is JavaScript-rendered and could not be
  automatically verified — see `docs/registry/SOURCE_VERIFICATION_POLICY.md`).

## The critical finding

`getActiveRegistry()` (`apps/web/src/lib/registry-data.ts`) never read
`registry_version_entries.snapshot` — it resolved the active release's _ID_ only, then joined
straight back to the live, mutable `crawlers`/`crawler_operators` tables for every evaluated
field. The same pattern existed in historical-scan rendering
(`get-scan-report.ts`, `domain-timeline.ts`). This meant:

- Editing a crawler's live row after a release was published silently changed what the
  _already-active_ release evaluated new scans against.
- Editing a crawler's live row after a scan was recorded silently changed how that _historical_
  scan's report displayed the crawler.
- The `registry_version_entries.snapshot` table — which genuinely did freeze a full JSON copy of
  each crawler at release-creation time — was functionally disconnected from both live evaluation
  and historical rendering, consulted only by the release-comparison diff tooling.

This directly contradicted this project's own prior documentation
(`docs/registry/CRAWLER_REGISTRY_GOVERNANCE.md`'s stated design intent that snapshots exist
"specifically so a historical scan's evidence never changes even if the live `crawlers` row is
later updated") and is exactly the first failure condition Section 209 names: _"Current audits
still combine an active registry version ID with mutable live crawler values."_

## A second confirmed bug

`compareRegistryVersions`'s "changed" detection was a raw full-snapshot JSON-string inequality —
editing a crawler's `description` wording, refreshing `lastVerifiedAt`, or moving
`officialSourceUrl` all counted identically to a real token or purpose change. Since the publish
route used this diff's changed-crawler-ID set to schedule customer re-evaluation, a purely
editorial or evidence-only edit could trigger real re-scans for customers — the exact failure
condition Section 209 also names: _"Source URL refresh creates a false policy-change event."_

## What this phase fixed

See the Phase 15 completion report for the full list. In summary: made the immutable release
snapshot the sole authority for both evaluation and historical rendering; replaced the
string-inequality diff with a field-level semantic classification (evaluation-semantic / evidence
/ editorial / internal); made publish/rollback atomic, idempotent, checksummed, and validated;
added rollback re-evaluation parity with forward publish; and independently re-verified every
current crawler against live official documentation rather than trusting the repository's stored
claims.

## Ruleset activation — same bug class, fixed alongside

`ruleset_versions.is_active` had the identical non-atomic two-`UPDATE` publish/rollback pattern as
`registry_versions`. Fixed with the same `db.batch()` approach. Ruleset _semantics_ (which rules
exist, what they evaluate) were not touched, per the standing prohibition on altering ruleset
behaviour as part of ordinary registry maintenance.
