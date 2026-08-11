# Operational Alert Model

**Level 2 document.** Phase 14 (§26/§32-34). First-party, deduplicated internal operational
alerting — no third-party paging/alerting service (PagerDuty, Opsgenie, Better Uptime, UptimeRobot,
Statuspage.io, Sentry, Datadog, New Relic, Grafana Cloud, Slack, Teams, SMS, email) is used or
added. Never publicly visible — consumed only by `/admin/operations` and its API.

## Schema

`operational_alerts` (migration `0032_operational_alerts.sql`,
`packages/database/src/schema/admin-security.ts`):

| Field                                         | Meaning                                                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `alert_key`                                   | Stable, human-readable identifier for the condition (e.g. `monitoring.backlog_critical`)             |
| `severity`                                    | `info` \| `warning` \| `critical` — an internal priority, never reused from public incident severity |
| `source`                                      | The table/signal the condition was derived from                                                      |
| `detail`                                      | Human-readable current detail, updated on every re-evaluation                                        |
| `first_seen_at`                               | When this exact condition (by `alert_key`) was first opened                                          |
| `last_seen_at`                                | Most recent evaluation that found the condition still present                                        |
| `occurrence_count`                            | How many evaluations have found it present, without a resolution in between                          |
| `resolved_at`                                 | `NULL` while active; set the moment the condition is no longer detected                              |
| `acknowledged_at` / `acknowledged_by_user_id` | Purely informational — does not resolve the alert                                                    |

A partial unique index (`idx_operational_alerts_open_key`, `WHERE resolved_at IS NULL`) enforces
"at most one open row per `alert_key`" at the database level, not just in application logic.

## Evaluation

`evaluateOperationalAlerts(db, rawDb, agencyLogos, now)`
(`apps/web/src/lib/admin/operational-alerts.ts`):

1. `computeAlertCandidates()` derives the current condition set from signals that already exist —
   `detectSchedulerAnomalies` (Phase 10/11), `getComponentHealth`/`getRecentWebhookFailureCount`/
   `getRecentAuthFailureCount` (`lib/admin/health.ts`), `getOperationalCapacitySnapshot` (Phase 11
   capacity). This function computes nothing new about the system's health — it only decides which
   already-known conditions are worth a persistent alert.
2. For each candidate: if an open row with the same `alert_key` exists, update `last_seen_at`/
   `occurrence_count`/`detail`/`severity` in place; otherwise insert a new row.
3. For each currently-open row whose `alert_key` is **not** in the candidate set, set
   `resolved_at` — resolution is fully automatic and only happens when the underlying condition is
   objectively no longer present, never manually (acknowledging an alert does not resolve it).

Runs once per day, from the same `scheduled()` invocation as the other daily jobs (see
`docs/operations/PHASE_14_SCHEDULED_JOB_ISOLATION_DECISION.md` for why), and on demand via
`POST /api/admin/operations/evaluate` (§44 "Re-run health evaluation").

## Current alert conditions

| `alert_key`                              | Severity | Trigger                                                |
| ---------------------------------------- | -------- | ------------------------------------------------------ |
| `scheduler.missed.<job>`                 | critical | No run recorded in > 2× the expected interval          |
| `scheduler.stuck.<job>`                  | critical | A `running` row older than 15 minutes                  |
| `scheduler.overlapping.<job>`            | warning  | >1 concurrent `running` row                            |
| `scheduler.long_execution.<job>`         | warning  | A run took longer than 5 minutes                       |
| `scheduler.excessive_failure_rate.<job>` | warning  | >30% of the last 20 runs failed                        |
| `billing.webhook_processing_failures`    | warning  | ≥3 webhook failures in the last hour                   |
| `auth.failure_spike`                     | critical | >50 authentication failures in the last hour           |
| `retention.job_degraded`                 | warning  | Last retention run `failed` or `completed_with_errors` |
| `monitoring.backlog_critical`            | critical | ≥1 active domain significantly overdue for monitoring  |
| `monitoring.platform_failure_spike`      | warning  | ≥5 platform-side scan failures in the last 24 hours    |

## Deduplication and flapping

One persistent condition produces exactly one logical row over its lifetime — never one row per
evaluation (enforced by the partial unique index, not just application discipline). Because
evaluation runs once daily (not continuously), rapid healthy/unhealthy oscillation within a single
day cannot occur by construction; a genuine flapping condition would show as repeated open/resolve
cycles across days, visible via `listRecentOperationalAlerts()`'s history — no additional
consecutive-failure/grace-window logic was added on top of the daily cadence, since the cadence
itself already provides the debounce the Phase 14 prompt's §34 asks for.

## Relationship to public incidents

None, automatically. An operational alert is never auto-published as a public incident (§24) — it
can only ever be an internal signal an administrator sees at `/admin/operations` and manually acts
on (including, if warranted, creating a real public incident through the existing, separate
incident-admin flow). See `docs/operations/PUBLIC_INCIDENT_COMMUNICATION_STANDARD.md`.

## Retention

Resolved alerts are not purged by this phase — see `docs/data/PHASE_14_OPERATIONS_QUERY_AND_INDEX_AUDIT.md`
for the current row-count/index reasoning and why unbounded growth is not yet a concern at
CrawlPact's real volume (one evaluation per day, a handful of conditions at most). Revisit if/when
`operational_alerts` row count becomes large enough to matter — the retention discipline
established in `lib/data-retention.ts` (Phase 11/13) is the pattern to reuse when that happens.
