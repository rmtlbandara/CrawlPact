# System Health

## Current state (Part 3, extended Phase 14)

A real Super Admin system-health view exists at `/admin/health`, built in Part 3 Step 7 against
the definition this document originally specified (kept below, since it's still the accurate
target definition — the implementation was built to match it, not the other way around). Phase 14
added a second, broader Super Admin view, `/admin/operations` — the unified operations control
plane (public/internal status, capacity, scheduler anomalies, deduplicated operational alerts,
reliability trends, safe manual re-run actions). `/admin/health` was kept, not replaced or
duplicated into — see `docs/operations/PUBLIC_INTERNAL_STATUS_BOUNDARY.md` and
`docs/operations/SERVICE_HEALTH_SIGNAL_MODEL.md` for the full current signal set.

## Health signals (SRS §28.2, §28.9, §28.10)

- Scheduled-job success rate (`scheduled_job_runs.status`), missed/overlapping/stuck-job
  detection — `lib/admin/scheduler.ts`'s `detectSchedulerAnomalies`. **Phase 14**: jobs now write a
  real `running` row before starting work (previously every insert happened post-hoc, so
  stuck/overlapping detection was structurally unreachable against real data — see
  `docs/operations/PHASE_14_STATUS_OPERATIONS_BASELINE.md`).
- Scan failure rate and category breakdown (`scans.status`, `scans.error_category`) —
  `lib/admin/scans.ts`'s `getScanOperationsSummary`, shown at `/admin/scans`.
- Webhook processing health (`webhook_events.status` distribution) — `/admin/webhooks`.
- Recent `security_events` volume by type — `/admin/security`.
- Overall component breakdown (D1, API, scheduler, retention job, webhook processing, auth) —
  `lib/admin/health.ts`'s `getComponentHealth`, always derived from real queried data, never a
  hardcoded "all healthy" claim.

## What's real vs. what's still a documented gap

Real: `worker.ts`'s `scheduled()` handler writes one `scheduled_job_runs` row per cron
invocation (for both the monitoring sweep and the daily retention purge), and `/admin/health`
reads that plus `scans`/`webhook_events`/`security_events` to compute the summary above — this is
genuinely live data, not a placeholder.

**Partially addressed, Phase 14**: `operational_alerts` (see
`docs/operations/OPERATIONAL_ALERT_MODEL.md`) now records a real, deduplicated alert row for a
missed/stuck job (and several other conditions), evaluated once daily and visible at
`/admin/operations`. This is still **pull-based, not push-based** — an operator still has to open
`/admin/operations` to notice, by deliberate design (§27 of the Phase 14 prompt explicitly
prohibits adding a third-party paging/alerting/notification provider — PagerDuty, email, SMS,
Slack, etc.). Genuinely automated, outbound alerting remains a real, disclosed gap, not solved by
this phase — it would need an outbound notification channel this project deliberately doesn't add.

## Manual check (if the admin UI itself is unreachable)

```bash
wrangler d1 execute crawlpact-db --remote --config apps/web/wrangler.jsonc \
  --command "SELECT job_name, status, started_at FROM scheduled_job_runs ORDER BY started_at DESC LIMIT 5;"
```
