# Monitoring Health State Model

Phase 10 adds an **operational** (Super-Admin-facing) health-state model. It does not replace or
duplicate `docs/product/MONITORING_STATUS_UX_MODEL.md`'s existing **user-facing** derived statuses,
which remain authoritative for what a customer sees on their own domain — that document's own
design principle ("no new states are added to the domain model... derived, not stored") is
preserved unchanged.

## States (derived, never stored)

| State                    | Meaning                                                           | Source fields                                                                                        | Notification generated                    |
| ------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `disabled`               | `monitoringFrequency = "none"` (Free plan, or user turned it off) | `domains.monitoring_frequency`                                                                       | No                                        |
| `active_healthy`         | Active, no failures, not currently due                            | `monitoring_state = active`, `consecutive_failure_count = 0`                                         | No                                        |
| `due`                    | Active, `next_scan_at` has passed, awaiting the next sweep        | `monitoring_state = active`, `next_scan_at <= now`                                                   | No                                        |
| `backoff_target_failure` | Active, 1+ target-side failures, below pause threshold            | `monitoring_state = active`, `consecutive_failure_count in [1, threshold)`, `failure_episode_id` set | Yes, from failure #2 (`resource_failure`) |
| `paused_target_failure`  | Reached the pause threshold                                       | `monitoring_state = paused`, `failure_episode_id` set                                                | Yes, once (`monitoring_paused`)           |
| `overdue_platform`       | Active, `next_scan_at` more than 48h in the past despite no pause | `monitoring_state = active`, `next_scan_at` stale                                                    | No (internal signal only — see below)     |
| `baseline_pending`       | Active, never successfully scanned                                | `monitoring_state = active`, `last_scan_id IS NULL`                                                  | No                                        |

`temporarily_unavailable` (global scheduler pause / maintenance mode) is not domain-level — it's the
existing `runtime_configuration.scheduler_paused`/`maintenance_mode` flags, already surfaced via
`apps/web/src/lib/admin/health.ts`'s component health.

## Target vs. platform failure — the state model's core distinction

`backoff_target_failure`/`paused_target_failure` are the _only_ states a target-side failure can
reach. A platform-side failure (CrawlPact's own processing error — a thrown exception before any
scan result exists) **never** transitions a domain into either state: `recordScheduledScanOutcome`'s
`platformFailure: true` branch touches only `lastScanId`/`lastScanAt`, never
`consecutiveFailureCount`, `failureEpisodeId`, or `monitoringState`. See
`apps/web/src/lib/domains.ts` and `PHASE_10_NOTIFICATION_MONITORING_THREAT_REVIEW.md`'s "platform
failure incorrectly treated as target failure" entry.

## `overdue_platform` — measurement, not a stored state

`countLongOverdueActiveDomains` (`notification-reconciliation.ts`) counts active domains whose
`next_scan_at` is more than 48h stale — a domain that structurally _should_ have self-healed via the
claim-lock/due-query mechanism but hasn't. Exposed via
`GET /api/admin/capacity`'s `monitoring.longOverdueActiveDomainCount`. A nonzero value indicates the
scheduler itself is degraded (e.g., `AUDIT_ENGINE_ENABLED` off for an extended period, or a sustained
scheduler pause), not a per-domain problem — no notification is generated for it (§26: "do not
notify users immediately for a small scheduler delay… use internal operational thresholds").

## Allowed actions per state

| State                                               | User action available                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| `disabled`                                          | Upgrade plan                                                             |
| `active_healthy` / `due` / `backoff_target_failure` | None required; manual rescan always available                            |
| `paused_target_failure`                             | Resume monitoring (existing domain-detail action, unchanged by Phase 10) |
| `baseline_pending`                                  | None; awaiting first scheduled scan                                      |

No state affects plan entitlement — entitlement is a separate, plan-driven property
(`monitoringFrequency`), never derived from health state.
