# Phase 10 — Notification Reconciliation Backfill Policy

## Question

When notification reconciliation (`apps/web/src/lib/notification-reconciliation.ts`) goes live,
should it look back over all of history, or only a bounded recent window?

## Decision

**Short recent lookback — 180 minutes (3 hours) by default, not unbounded, not zero.**

`reconcileMissingPolicyChangeNotifications(db, now, { lookbackMinutes = 180 })` only scans
`domain_change_events` rows with `observed_at >= now - lookbackMinutes`. Verified via
`notification-dedupe-reconciliation.integration.test.ts`'s "respects its bounded lookback window"
test — a 10-day-old high-attention event outside a 60-minute window is confirmed not recreated.

## Why not "no historical backfill" (start at deployment only)

Reconciliation's whole purpose is recovering a notification that should exist because its
underlying event already committed but the notification write failed. A zero-lookback policy would
only protect against a failure occurring _after_ reconciliation starts running, leaving any failure
in the hours immediately before deployment permanently unrecovered — defeating the point of having
reconciliation at all for the very failures most likely to be caught by an initial rollout (transient
Worker/D1 issues are exactly the kind of thing more likely near a deploy).

## Why not unbounded (recover everything, ever)

- **Source-event reliability**: `domain_change_events` existed before Phase 10 and this phase's own
  baseline confirms production has zero rows in the `notifications` table today — an unbounded scan
  the first time this job runs would attempt to recreate every historical attention-worthy event
  since Phase 8 shipped, most of which are now stale/irrelevant to the user and would flood a
  previously-empty notification centre with old history, violating this phase's own explicit "do
  not suddenly generate months of old unread notifications" instruction.
- **Unbounded table scan risk**: `domain_change_events` grows without an approved retention decision
  of its own; scanning all of it on every reconciliation run is the unbounded-scan anti-pattern this
  phase explicitly prohibits.

## Bounds enforced

- `lookbackMinutes` (default 180) — time window.
- `batchSize` (default 200) — row cap per run, independent of the time window.
- Idempotent: checked against `notifications` by `(sourceType, sourceId)` before any insert, and the
  insert itself is idempotent via `createNotificationOnce`'s unique `(user_id, dedupe_key)` index —
  safe under concurrent/repeated execution.
- Skips a domain that has since been soft-deleted — never recreates a notification for a subject
  that no longer exists for the owner.
- Runs as its own independent scheduled job (`worker.ts`'s `runNotificationReconciliationJob`),
  gated behind `AUDIT_ENGINE_ENABLED` only — not by `scheduler_paused`/`maintenance_mode`, since it
  reads already-committed history and never triggers a new scan.

## Re-evaluation trigger

Revisit the 180-minute default only with production evidence that the real gap between a
notification-write failure and the next reconciliation run regularly exceeds it (the daily cron
means a single missed occurrence self-heals within 24h regardless, since the job re-runs daily with
the same rolling window).
