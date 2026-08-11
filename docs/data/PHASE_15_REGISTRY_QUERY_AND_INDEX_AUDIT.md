---
Document owner: Engineering owner
Status: current-authoritative
Last verified: 2026-08-11
---

# Phase 15 — Registry Query and Index Audit

Real `EXPLAIN QUERY PLAN` evidence (via `wrangler d1 execute --local`) for the registry queries
this phase added or changed.

## `getRegistryVersionSnapshotMap` — the new authoritative read path

```sql
SELECT crawler_id, snapshot FROM registry_version_entries WHERE registry_version_id = ?
```

```
SEARCH registry_version_entries USING INDEX idx_registry_version_entries_registry_version_id (registry_version_id=?)
```

Uses the existing index (migration 0004) — no new index needed. This is the query every scan and
every historical report render now depends on for crawler identity, so its plan matters more
after Phase 15 than before.

## `getActiveRegistry` — active-release/ruleset lookup

```sql
SELECT id FROM registry_versions WHERE is_active = 1
```

```
SEARCH registry_versions USING INDEX idx_registry_versions_single_active (is_active=?)
```

Uses the existing partial-unique index (migration 0009). Unchanged by this phase.

## `getAffectedDomains` — unchanged query, re-verified

```sql
SELECT domains.id FROM domains
  JOIN scan_crawler_results ON scan_crawler_results.scan_id = domains.last_scan_id
  WHERE domains.deleted_at IS NULL AND scan_crawler_results.crawler_id IN (...)
```

```
SCAN domains USING INDEX idx_domains_owner_origin_live
SEARCH scan_crawler_results USING COVERING INDEX sqlite_autoindex_scan_crawler_results_2 (scan_id=? AND crawler_id=?)
```

Pre-existing query, not modified this phase. `domains` is scanned (filtered by the live-index,
not a full table scan of all rows including deleted) and joined per-row to
`scan_crawler_results` via its existing composite index. At current data volume (dozens of saved
domains) this is fine; if the saved-domain count grows by orders of magnitude, this join would be
worth revisiting — noted here for a future phase, not a regression introduced now.

## `registry_version_activations` (new table)

```sql
SELECT * FROM registry_version_activations WHERE registry_version_id = ? ORDER BY created_at DESC
```

```
SEARCH registry_version_activations USING INDEX idx_registry_version_activations_version_id (registry_version_id=?)
USE TEMP B-TREE FOR ORDER BY
```

The `WHERE` clause uses the new index; the `ORDER BY` requires a temp b-tree because no
compound `(registry_version_id, created_at)` index exists. **No code currently queries this
table filtered by a specific version** — it's write-only this phase (populated by
`publishRegistryVersion`/`rollbackRegistryVersion`, no reader built yet, see
`docs/registry/PHASE_15_REGISTRY_BASELINE.md`'s "deliberately not done" section). The simple
"most recent activations across all releases" access pattern
(`ORDER BY created_at DESC` with no filter) already uses
`idx_registry_version_activations_created_at` cleanly with no temp b-tree. If a future phase
builds a per-release activation-history view, add a compound index at that time rather than
pre-optimising an unused query shape now.

## `createRegistryRelease` — batched insert

Pre-Phase-15 this was N sequential single-row inserts (up to 23, once per crawler). Now a single
`db.batch()` (Phase 11's established pattern) — one D1 round trip regardless of crawler count,
verified by code inspection of `apps/web/src/lib/admin/registry.ts`'s `createRegistryRelease`
(matches the existing `persist-scan.ts` batching pattern, no separate benchmark needed given the
row count involved, ~23, is far below the volumes Phase 11 benchmarked).
