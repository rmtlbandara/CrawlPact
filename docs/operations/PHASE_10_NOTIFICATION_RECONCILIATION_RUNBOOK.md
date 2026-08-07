# Runbook — Notification Reconciliation

## What this job does

`runNotificationReconciliationJob` (`apps/web/src/worker.ts`) runs `reconcileMissingPolicyChangeNotifications`
(`apps/web/src/lib/notification-reconciliation.ts`) once daily, alongside (but independently of) the
monitoring sweep. It recovers a policy-change notification that should exist because its underlying
`domain_change_events` row already committed, but the notification write itself failed. See
`docs/architecture/NOTIFICATION_RELIABILITY_ARCHITECTURE.md` for why this exists.

## Checking status

`SELECT * FROM scheduled_job_runs WHERE job_name = 'notification_reconciliation' ORDER BY started_at DESC LIMIT 10;`
(via `wrangler d1 execute`), or `GET /api/admin/capacity`'s `notifications.reconciliationLastRun`.
A successful run's `error_summary` reads `scanned=N created=M` — `created` is normally 0 or very
small; a sustained nonzero `created` count across many consecutive runs would indicate the primary
notification-write path is failing repeatedly and reconciliation is doing most of the real work,
which itself is a signal worth investigating (see `platformFailureCountLast24h` and Workers Logs for
"Policy-change notification generation failed" entries).

## If a run shows `status = 'failed'`

1. Check `error_summary` for the thrown error message.
2. This job never touches monitoring state or triggers a scan — a failure here cannot affect the
   monitoring sweep (independent `ctx.waitUntil()`, independent `scheduled_job_runs` row). No
   customer-facing scan/monitoring impact to assess.
3. The job is idempotent and safe to leave failing for one cycle — the next day's run picks up the
   same (or a wider, since the window is time-based and rolls forward) recent-events window. No
   manual recovery is required for a single missed run.
4. If it fails repeatedly, check for a D1 outage/quota issue (same class of cause as any other
   scheduled job failure — cross-reference with `retention.lastRun` and the monitoring sweep's own
   job status in the same `GET /api/admin/capacity` response).

## Manually invoking reconciliation

Not exposed as an admin action in Phase 10 (no `/api/admin/*` trigger route was added — the daily
cron is sufficient at current volume). If an out-of-band run is ever needed, it can be invoked
directly via `reconcileMissingPolicyChangeNotifications(db, new Date(), { lookbackMinutes })` from a
Worker console/script — the function itself accepts an optional wider lookback window for exactly
this "wider recovery" scenario, still bounded by `batchSize`.

## What this job will never do

- Never recreates a notification for a domain that's been soft-deleted since the event.
- Never recreates history outside its bounded lookback window (default 180 minutes) —
  see `docs/product/PHASE_10_NOTIFICATION_RECONCILIATION_BACKFILL_POLICY.md`.
- Never creates a duplicate — enforced at the D1 level via `idx_notifications_user_dedupe`, not just
  the pre-check.
- Never reruns a website scan.
