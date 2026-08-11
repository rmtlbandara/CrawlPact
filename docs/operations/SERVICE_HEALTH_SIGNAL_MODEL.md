# Service Health Signal Model

**Level 2 document.** Phase 14. For every internal health signal CrawlPact evaluates: name, source,
query, evaluation window, thresholds, public-impact relationship, operator action, and known
limitations. Composes existing Phase 10/11 modules — this document does not introduce a second
monitoring engine.

## D1

| Field            | Value                                                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source           | `lib/admin/health.ts` (`getComponentHealth`, "D1 database")                                                                                                                                |
| Query            | Implicit — reachability is proven by the page's own queries completing                                                                                                                     |
| Window           | Real-time (per request)                                                                                                                                                                    |
| Healthy          | Any query completed                                                                                                                                                                        |
| Warning/Critical | Not distinguishable from inside a Worker — a D1 outage prevents the health check itself from running, which surfaces as `status_unavailable` on the public page, not a "D1: critical" chip |
| Public impact    | No dedicated public component; affects every component simultaneously if D1 is genuinely down                                                                                              |
| Operator action  | Check Cloudflare D1 dashboard/status directly; see `docs/operations/BACKUP_AND_RECOVERY.md` and `docs/operations/DISASTER_RECOVERY_RUNBOOK.md`                                             |
| Limitation       | Cannot distinguish "D1 slow" from "D1 down" from inside the Worker                                                                                                                         |

## Worker/API

| Field            | Value                                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source           | `lib/admin/health.ts` ("API" component)                                                                                                                              |
| Query            | `runtime_configuration.maintenance_mode`                                                                                                                             |
| Window           | Real-time                                                                                                                                                            |
| Healthy          | Not in maintenance mode                                                                                                                                              |
| Warning/Critical | Maintenance mode enabled → `maintenance`                                                                                                                             |
| Public impact    | `true` when in maintenance (a real, deliberate, user-facing state)                                                                                                   |
| Operator action  | `/admin/settings` to toggle maintenance mode                                                                                                                         |
| Limitation       | No visibility into unhandled Worker exceptions or CPU-limit terminations from inside the Worker itself (Cloudflare's own dashboard is the source of truth for those) |

## Scheduler

| Field           | Value                                                                                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source          | `lib/admin/scheduler.ts` (`detectSchedulerAnomalies`), `lib/admin/health.ts`                                                                                                             |
| Query           | Last 200 `scheduled_job_runs` rows, grouped by `job_name`                                                                                                                                |
| Window          | Rolling (last 200 runs per job; "missed" uses a 2×-expected-interval threshold, currently 2 hours since jobs run daily)                                                                  |
| Healthy         | Most recent run < 2h old, no `running` row > 15 min old, ≤1 concurrent `running` row, no run > 5 min duration, <30% of last 20 runs failed                                               |
| Warning         | `overlapping`, `long_execution`, `excessive_failure_rate`                                                                                                                                |
| Critical        | `missed`, `stuck`                                                                                                                                                                        |
| Public impact   | No direct mapping except via `scheduled_monitoring`'s own signal below                                                                                                                   |
| Operator action | `/admin/jobs`, `/admin/operations`                                                                                                                                                       |
| Limitation      | Fixed this phase — see `docs/operations/PHASE_14_STATUS_OPERATIONS_BASELINE.md` "Existing Cron jobs" for the `running`-row fix that makes stuck/overlapping detection actually reachable |

## Monitoring

| Field           | Value                                                                                                                                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source          | `lib/admin/health.ts` ("Scheduler / monitoring sweep"), `lib/admin/capacity.ts` (backlog/failure counts)                                                                                                                                                              |
| Query           | Last `monitoring_sweep` `scheduled_job_runs` row; `domains` due/overdue/paused counts; `scans.status` counts (target vs. platform failure)                                                                                                                            |
| Window          | Last run (job status), 24h (failure counts), real-time (backlog)                                                                                                                                                                                                      |
| Healthy         | Last sweep completed, no long-overdue active domains                                                                                                                                                                                                                  |
| Warning         | Backlog growing, no cadence commitment breached yet                                                                                                                                                                                                                   |
| Degraded        | Eligible domains overdue                                                                                                                                                                                                                                              |
| Critical        | `longOverdueActiveDomainCount > 0` (Phase 14 operational-alert threshold)                                                                                                                                                                                             |
| Public impact   | `false` for the last-sweep-status signal alone (delays the _next_ report, doesn't block current site use); monitoring truth itself remains owned entirely by Phase 10 (`lib/monitoring.ts`) — this signal model never re-derives due/overdue/paused, it only reads it |
| Operator action | `/admin/jobs`, `/admin/domains`, `/admin/operations`                                                                                                                                                                                                                  |
| Limitation      | Thresholds (`longOverdueActiveDomainCount`, platform-failure-spike count) are first, conservative defaults — not yet tuned against sustained real production volume                                                                                                   |

## Retention

| Field           | Value                                                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source          | `lib/admin/health.ts` ("Data retention job")                                                                                                                                           |
| Query           | Last `data_retention_purge` `scheduled_job_runs` row                                                                                                                                   |
| Window          | Last run                                                                                                                                                                               |
| Healthy         | `completed`                                                                                                                                                                            |
| Warning         | `completed_with_errors` (per-category failure, isolated — see `lib/data-retention.ts`) or `failed`                                                                                     |
| Public impact   | `false` — purely an internal/background job with no public-component mapping                                                                                                           |
| Operator action | `/admin/jobs`; `POST /api/admin/operations/retention-dry-run` to verify what the next run would affect                                                                                 |
| Limitation      | No retention category exists yet for `security_events`/`notifications` — see `docs/data/PHASE_14_SECURITY_EVENT_RETENTION_DECISION.md` / `PHASE_14_NOTIFICATION_RETENTION_DECISION.md` |

## Notifications

| Field           | Value                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------ |
| Source          | `lib/admin/capacity.ts` (`notifications.createdLast24h`, `reconciliationLastRun`)          |
| Query           | `notifications` created-count (24h), last `notification_reconciliation` job row            |
| Window          | 24h / last run                                                                             |
| Public impact   | `false` — Phase 10's own invariant: "notification failure must not alter monitoring truth" |
| Operator action | `POST /api/admin/operations/reconcile-notifications`                                       |

## Billing

| Field           | Value                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Source          | `lib/admin/health.ts` ("Paddle webhook processing"), `getRecentWebhookFailureCount`                                                 |
| Query           | `webhook_events` where `status IN ('failed','permanently_failed')`, last 1 hour                                                     |
| Window          | 1 hour                                                                                                                              |
| Healthy         | 0 recent failures                                                                                                                   |
| Warning         | ≥1 recent failure (surfaces internally immediately)                                                                                 |
| Public impact   | `true` only at ≥3 recent failures — a single failure is not, on its own, evidence of a widespread pattern (Paddle retries delivery) |
| Operator action | `/admin/webhooks` (`retryWebhookEvent`)                                                                                             |

## Authentication

| Field           | Value                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Source          | `lib/admin/health.ts` ("Authentication"), `getRecentAuthFailureCount`                           |
| Query           | `security_events` where `event_type = 'auth_failure'`, last 1 hour                              |
| Window          | 1 hour                                                                                          |
| Healthy         | ≤50 recent failures (well above normal wrong-password/bad-passkey noise)                        |
| Public impact   | `true` above the threshold — a real breach past that bar means visitors cannot reliably sign in |
| Operator action | `/admin/security`                                                                               |

## Reports

| Field         | Value                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source        | No dedicated signal exists — private-report retrieval failures are not separately tracked                                                                                                                                                                                                                                                                                                                                        |
| Public impact | N/A                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Limitation    | Disclosed gap, not addressed this phase — `reports_sharing`'s public component has no internal signal mapping (see `PUBLIC_COMPONENT_SIGNAL_MAPPING.md`), matching the "do not create a component signal based on a metric that cannot actually detect user impact" rule; a synthetic share-route check was considered (§13 of the Phase 14 prompt) and not implemented — see `docs/operations/PHASE_14_RELIABILITY_GAME_DAY.md` |

## Storage

| Field         | Value                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Source        | `lib/admin/capacity.ts` (`d1.tableCount`, `r2.agencyLogosObjectCount`)                                                                      |
| Query         | `sqlite_master` count, R2 `list()`                                                                                                          |
| Window        | Real-time                                                                                                                                   |
| Public impact | `false` — capacity indicators, not incident signals; see `docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md` for the actual upgrade thresholds |
