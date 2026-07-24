# System Health

## Current state (Part 3)

A real Super Admin system-health view exists at `/admin/health`, built in Part 3 Step 7 against
the definition this document originally specified (kept below, since it's still the accurate
target definition — the implementation was built to match it, not the other way around).

## Health signals (SRS §28.2, §28.9, §28.10)

- Scheduled-job success rate (`scheduled_job_runs.status`), missed/overlapping/stuck-job
  detection — `lib/admin/scheduler.ts`'s `detectSchedulerAnomalies`.
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

Still a gap: no automated alerting (e.g. paging/email) on a missed or stuck job — an operator has
to actually open `/admin/health` to notice. Automated alerting was not built in Part 3; it would
need an outbound notification channel this project doesn't currently have (see
`docs/status/KNOWN_RISKS.md` for what's tracked as genuinely open vs. resolved).

## Manual check (if the admin UI itself is unreachable)

```bash
wrangler d1 execute crawlpact-db --remote --config apps/web/wrangler.jsonc \
  --command "SELECT job_name, status, started_at FROM scheduled_job_runs ORDER BY started_at DESC LIMIT 5;"
```
