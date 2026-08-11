# Phase 16 research query and index audit

`EXPLAIN QUERY PLAN` run against a real local D1 instance (migration `0035` applied) for every
query the Observatory/research code issues against `research_publications`.

## Public lookup by slug (`getVisibleResearchPublicationBySlug`)

```sql
SELECT * FROM research_publications WHERE slug = ?;
```

```
SEARCH research_publications USING INDEX sqlite_autoindex_research_publications_2 (slug=?)
```

Uses the `UNIQUE` constraint's automatic index — no separate index needed.

## Public "latest research" list (`listPublishedResearchPublications`)

```sql
SELECT * FROM research_publications WHERE status IN ('published','corrected') ORDER BY published_at DESC;
```

```
SEARCH research_publications USING INDEX idx_research_publications_status (status=?)
USE TEMP B-TREE FOR ORDER BY
```

Uses `idx_research_publications_status` for the filter; a temp B-tree sort is used for ordering.
Acceptable at current and realistically expected row counts (publications are created manually,
never per-observation) — not worth a composite `(status, published_at)` index yet. Revisit if
publication volume ever grows beyond a handful.

## Admin "all publications" list (`listResearchPublications`)

```sql
SELECT * FROM research_publications ORDER BY created_at DESC;
```

```
SCAN research_publications
USE TEMP B-TREE FOR ORDER BY
```

A full table scan — correct and intentional: this is a Super Admin-only, unbounded (no corpus, so
no pagination need) listing of every publication regardless of status, and the table has at most a
handful of rows for the foreseeable future (manual publication only, no automated generation).

## Reproducibility lookup by registry release (`idx_research_publications_registry_version_id`)

Not yet exercised by any shipped query (no UI currently filters by registry release), but indexed
proactively since `reproduceResearchPublication()` and any future "which publications are pinned to
release X" admin tooling would need it, and adding an index later to an already-populated table is
strictly more disruptive than including it in the original migration.

## Registry Observatory queries (no new tables — reuses Phase 15 indexes)

`getRegistryObservatorySnapshot`/`computeRegistryObservatoryForRelease` read
`registry_versions`/`registry_version_entries` via `getRegistryVersionSnapshotMap` (unchanged from
Phase 15) and `registry_version_activations`-adjacent tables via `computeSemanticDiff` (also
unchanged) — no new query shapes against those tables, so no new index audit was needed for them;
Phase 15's `PHASE_15_REGISTRY_QUERY_AND_INDEX_AUDIT.md`-equivalent coverage still applies.
