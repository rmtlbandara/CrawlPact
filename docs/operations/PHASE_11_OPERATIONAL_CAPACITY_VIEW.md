# Phase 11 operational capacity view

Stage 11H. `GET /api/admin/capacity` (`apps/web/src/lib/admin/capacity.ts`,
`getOperationalCapacitySnapshot`) — a read-only, `requireAdminSession`-gated admin surface
returning real, live operational metrics. Per this phase's own instruction ("may defer the UI in
favor of a documented command if UI would be disproportionate scope"), this ships as a documented
API endpoint rather than a new dashboard page — every metric is real and queryable today; a UI
surface for it is deferred as a small, low-risk follow-up that doesn't need to gate this phase.

## What it returns (real, queried live on every call)

| Field                                        | Source                                                                                                | Notes                                                                                                                                                                                               |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `d1.tableCount`                              | `sqlite_master`, real query                                                                           | Same query the Stage 11A baseline used manually via Cloudflare MCP — now a live in-app check.                                                                                                       |
| `r2.agencyLogosObjectCount` / `r2.truncated` | `AGENCY_LOGOS.list({ limit: 1000 })`                                                                  | Bounded to 1,000 objects — see the Stage 11D orphan-cleanup doc for why that's ample at real volume; `truncated` discloses if the bound was ever hit.                                               |
| `scans.last24h`                              | `scans` count, `started_at >= now - 24h`                                                              |                                                                                                                                                                                                     |
| `scans.avgResourceBytesPerScan`              | `avg(scan_resources.content_size_bytes)`                                                              | Real average across every persisted resource row.                                                                                                                                                   |
| `scans.avgFindingsPerScan`                   | `count(findings) / count(scans)`                                                                      |                                                                                                                                                                                                     |
| `scans.avgD1StatementsPerScan`               | `1 + avg(scan_resources rows) + avg(scan_crawler_results rows) + avg(findings rows)` per scan         | Same real formula the Stage 11A baseline derived manually (`docs/performance/PHASE_11_PRODUCTION_CAPACITY_BASELINE.md` §8.2) — now computed live instead of requiring a manual MCP query each time. |
| `monitoring.dueNowCount`                     | Real count of `domains` matching the exact same WHERE clause `claimDueDomains` (`monitoring.ts`) uses | Not a re-derived approximation — the identical filter.                                                                                                                                              |
| `monitoring.oldestOverdueNextScanAt`         | Min `next_scan_at` among due domains                                                                  | `null` if nothing is currently overdue.                                                                                                                                                             |
| `retention.lastRun`                          | Most recent `scheduled_job_runs` row for `data_retention_purge`                                       | Real status/timestamps — reflects the Stage 11D hardening (chunking, dry-run, per-category isolation) results directly.                                                                             |

## What it deliberately reports as `null` — and why each one is a real constraint, not laziness

The Phase 11 prompt named several additional metrics (Cloudflare account plan, Worker CPU-limit
error counts, build bundle size, D1 database size). All four are reported as `null` under
`notAvailableFromThisWorker`, each for a specific, verified reason:

- **`d1SizeBytes`** — attempted first, not assumed unavailable. `PRAGMA page_count` / `PRAGMA
page_size` (the standard SQLite way to compute a database's real byte size) were tried directly
  against the real D1 binding, both in this repo's Miniflare-backed integration harness and
  logically consistent with why Stage 11A's baseline measurement had to use the Cloudflare
  management API (`d1_database_query` via MCP) rather than an in-app query for this exact number.
  Both PRAGMAs are rejected by D1's binding API with `SQLITE_AUTH` — confirmed by a real failing
  test call before this was understood, not assumed. D1's binding API allows _some_ PRAGMAs
  (`table_info`, `foreign_key_list` — both used elsewhere in this codebase) but not the
  storage-engine-level ones. **This means D1 database size is not obtainable from inside a
  Worker at all**, only via the Cloudflare account-management API, exactly the same boundary the
  next three items sit behind.
- **`cloudflarePlan`** — Cloudflare's account/subscription plan is account-management-API data
  (`GET /accounts/{id}/subscriptions`, the same call Stage 11A used manually), not something any
  binding exposes to a running Worker.
- **`workerCpuLimitErrors`** — Workers Observability data, a separate Cloudflare API surface a
  Worker cannot query about itself from inside a request handler.
- **`bundleSizeBytes`** — a build-time artifact statistic (the deployed Worker's compiled size),
  produced by `wrangler deploy`/CI build output, not a runtime fact the Worker can introspect about
  its own already-deployed bundle.

An admin who needs any of these four checks them the same way Stage 11A did: the Cloudflare
dashboard, the Cloudflare API directly, or CI build logs — this endpoint does not pretend to have
an answer it cannot honestly compute, per CLAUDE.md's "never present fabricated data as a real
outcome" rule.

## Access and audit

`requireAdminSession` only (no `requireAdminAction`, no audit-log entry) — this is a read, exactly
like `/api/admin/health` and `/api/admin/jobs`, which established the same "reads don't need
step-up auth or an audit trail, only an active admin session" precedent this endpoint follows.

## Verification

Real D1 + fake-R2 integration tests
(`apps/web/tests/integration/admin-capacity.integration.test.ts`): a non-admin session is
rejected; a real inserted scan and domain produce real non-zero/non-null values in the response;
every `notAvailableFromThisWorker` field is asserted `null`, never a placeholder; a real overdue
domain and a real `scheduled_job_runs` row produce a real due-count and real last-retention-run
status.
