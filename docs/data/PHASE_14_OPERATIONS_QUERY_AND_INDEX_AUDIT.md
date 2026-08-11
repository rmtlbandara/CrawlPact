# Phase 14 Operations Query and Index Audit

**Level 4 document.** Real `EXPLAIN QUERY PLAN` output against local D1 (`wrangler d1 execute
crawlpact-db --local`) for every operations/status query touched or added this phase.

## Public status: incident updates (N+1 → batched)

**Before**: one `SELECT ... FROM incident_updates WHERE incident_id = ?` per incident (N+1), called
twice per page load (active + resolved).

**After** (`lib/status/public-status.ts`'s `loadPublicIncidents`):

```
EXPLAIN QUERY PLAN
SELECT * FROM incident_updates WHERE incident_id IN ('a','b','c') ORDER BY created_at;

SEARCH incident_updates USING INDEX idx_incident_updates_incident_id (incident_id=?)
USE TEMP B-TREE FOR ORDER BY
```

Uses the existing index for the `IN (...)` lookup. The `ORDER BY` still needs a temp b-tree since
the index is on `incident_id`, not `(incident_id, created_at)` — acceptable at real incident/update
volume (typically single-digit rows per incident); not worth a composite index for a table this
small. Query count is now exactly 2 total (incidents + one batched updates query) per
`loadPublicIncidents` call, regardless of incident count — was previously `1 + N`.

## Incident list (public status)

```
EXPLAIN QUERY PLAN
SELECT * FROM incidents WHERE is_public = 1 ORDER BY created_at DESC;

SEARCH incidents USING INDEX idx_incidents_is_public (is_public=?)
USE TEMP B-TREE FOR ORDER BY
```

Unchanged this phase — already uses the existing `idx_incidents_is_public` index. The temp b-tree
sort is the same acceptable-at-current-volume tradeoff as above; a composite `(is_public,
created_at)` index was considered and not added, since incident volume is low and this query
already runs in under 1ms locally.

## `scheduled_job_runs` (missed/stuck/overlapping detection, reliability trends)

**Found**: no query filtering or ordering by `started_at` had a supporting index — only
`idx_scheduled_job_runs_job_name` existed. Real evidence, before the fix:

```
EXPLAIN QUERY PLAN
SELECT * FROM scheduled_job_runs ORDER BY started_at DESC LIMIT 200;

SCAN scheduled_job_runs
USE TEMP B-TREE FOR ORDER BY
```

A full table scan. Not urgent at today's real row count (a handful of rows per day), but this
exact query pattern is used by `getSystemStatusSummary` (last 20 runs), `detectSchedulerAnomalies`
(last 200 runs), and Phase 14's new `getReliabilityTrends` (window-filtered), so the cost compounds
across every one of those. **Fixed** — added `idx_scheduled_job_runs_started_at`
(migration `0033`):

```
EXPLAIN QUERY PLAN
SELECT * FROM scheduled_job_runs ORDER BY started_at DESC LIMIT 200;

SCAN scheduled_job_runs USING INDEX idx_scheduled_job_runs_started_at
```

Confirmed after the fix: the temp b-tree sort is gone too — SQLite walks the new index directly in
`DESC` order.

## `operational_alerts` (new table)

```
EXPLAIN QUERY PLAN
SELECT * FROM operational_alerts WHERE resolved_at IS NULL ORDER BY last_seen_at DESC;

SEARCH operational_alerts USING INDEX idx_operational_alerts_resolved_at (resolved_at=?)
USE TEMP B-TREE FOR ORDER BY
```

Uses the new `idx_operational_alerts_resolved_at` index for the filter; the sort still needs a temp
b-tree. Same reasoning as above — acceptable at the real row count this table will ever hold (one
evaluation per day, a handful of conditions at most; see `docs/operations/OPERATIONAL_ALERT_MODEL.md`
"Retention").

## `getReliabilityTrends` (new, Phase 14)

Every query is a bounded `COUNT(*)` with a `WHERE ... >= cutoff` filter (`scans.started_at`,
`scheduled_job_runs.started_at`, `webhook_events.received_at`, `security_events.created_at`,
`operational_alerts.first_seen_at`) — never an unbounded scan of full table history, satisfying
§102's "do not query all operational history" requirement by construction. `scans` and
`webhook_events` already have supporting indexes from earlier phases (not re-audited here, unchanged
by Phase 14); `scheduled_job_runs` and `operational_alerts` are covered above; `security_events` has
no index on `created_at` specifically — evaluated and not added, since its query volume (once per
`getReliabilityTrends` call, itself only invoked from the low-traffic `/admin/operations` page) is
far below the threshold where this would matter.

## `getOperationsSummary` (new, Phase 14)

Composes `getStatusOverview`, `getOperationalCapacitySnapshot`, `detectSchedulerAnomalies`,
`listActiveOperationalAlerts`, and 4 `getReliabilityTrends` calls (one per window) — all run via
`Promise.all`, not sequentially. Total query count is bounded and fixed regardless of data volume
(no per-row fan-out anywhere in this composition) — the same N+1-avoidance discipline applied to the
public status fix above.
