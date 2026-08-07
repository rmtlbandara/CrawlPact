# Runbook — Monitoring Reliability (Phase 10)

## Checking overall monitoring health

`GET /api/admin/capacity` (Super Admin session required) — the `monitoring` block:
`dueNowCount`, `oldestOverdueNextScanAt`, `pausedDomainCount`, `platformFailureCountLast24h`,
`targetFailureCountLast24h`, `longOverdueActiveDomainCount`. Compare against
`PHASE_10_MONITORING_RELIABILITY_THRESHOLDS.md`.

## A domain is stuck / not being scanned

1. Check `monitoringState` and `monitoringFrequency` on the domain (Admin Domains,
   `GET /api/admin/domains`). `monitoringFrequency = "none"` (Free plan) means it's never scheduled
   by design.
2. If `monitoringState = "paused"`: it reached the consecutive-target-failure threshold (5 by
   default). Check the domain's `monitoring_paused` notification / `resource_failure` history for
   the reason. Resuming is a customer action on the domain-detail page (unchanged by Phase 10).
3. If `monitoringState = "active"` but `nextScanAt` is far in the past: check
   `monitoring.longOverdueActiveDomainCount` — if nonzero across many domains, the scheduler itself
   is degraded (see below), not this one domain.

## `platformFailureCountLast24h` is elevated

This means CrawlPact's own processing threw an exception during scans (a D1 error, an uncaught
scanner/orchestrator exception) — **never** counted toward any domain's `consecutiveFailureCount` or
pause threshold (Phase 10's core fix; see
`docs/architecture/NOTIFICATION_RELIABILITY_ARCHITECTURE.md`). Check Workers Logs for "Platform-side
scan failure" entries (includes `domainId`/`scanId`) and the corresponding `scans` rows with
`status = 'internal_failure'` for the affected domains/timeframe. Customer monitoring is not paused
by this — no customer-facing incident by itself unless it recurs for the same domain across many
sweeps (in which case that domain's _legitimate_ scans simply aren't happening, worth investigating
directly).

## The scheduler itself appears paused/stalled

1. Check `runtime_configuration` for `scheduler_paused`/`maintenance_mode` (Admin Jobs page already
   surfaces this, Phase 11).
2. Check the most recent `scheduled_job_runs` row for `job_name = 'monitoring_sweep'` — a
   `'completed'` status with an `error_summary` starting "Skipped:" means one of the two pause flags
   is active, by design (unaffected by Phase 10).
3. Use `apps/web/src/lib/admin/scheduler.ts`'s existing anomaly detection (`missed`, `overlapping`,
   `stuck`, `long_execution`, `excessive_failure_rate`) — Phase 11, unchanged.

## Monitoring cadence verification

Solo monthly / Pro+Agency weekly — verify via `computeNextScanAt` (`scan-scheduling.ts`), unchanged
by Phase 10. No Phase 10 change touches monitoring frequency; if cadence ever appears wrong, that is
a regression outside this phase's scope and should be triaged against `scan-scheduling.ts` directly.

## Rollback

See `docs/reports/PHASE_10_NOTIFICATION_MONITORING_COMPLETION_REPORT.md`'s "Rollback and
forward-fix" section.
