# Notification Reliability Architecture

## The invariant

> Monitoring truth must never depend on notification delivery succeeding.

Before Phase 10, this did not hold: `handleScanSuccess` called `createNotification` (unguarded)
_before_ `recordScheduledScanOutcome`, inside `runMonitoringSweep`'s single `try` block. A thrown
notification-write error propagated to the outer `catch`, which then called
`persistFailedScanRecord` (attempting a second, duplicate `scans` row — mitigated only by
`onConflictDoNothing`) and `handleScanFailure` a second time, incrementing
`consecutiveFailureCount` for a scan that had, in truth, already completed successfully. A real,
provable bug, not a hypothetical.

## The fix — Option A, best-effort after authoritative commit

Chosen over Option B (durable notification-intent table + separate materialising processor) and
Option C (pure reconciliation, no synchronous attempt at all) as the simplest design giving durable
recovery without new infrastructure. The conceptual order in `handleScanSuccess`/`handleScanFailure`
(`apps/web/src/lib/monitoring.ts`) is now:

1. Run audit, persist scan (unchanged).
2. Determine authoritative outcome (unchanged).
3. Generate the Phase 8 timeline event (`safeGenerateTimelineEvent` — already existed, already
   failure-isolated; Phase 10 changes its return type to the full row so notification generation
   can use it directly).
4. **Commit authoritative monitoring state** (`recordScheduledScanOutcome`) — success/failure count,
   `next_scan_at`, `failure_episode_id`, `monitoringState`.
5. **Only then**, attempt notification generation (`safeNotifyPolicyChange` /
   `safeNotifyTargetFailure`), wrapped in its own `try/catch` that logs
   (`console.error`, visible in Workers Logs) and returns — never rethrows, never reaches step 4's
   caller.

If step 5 fails: scan remains successful, `lastScanId`/`lastScanAt`/`nextScanAt`/
`consecutiveFailureCount`/`monitoringState` are all already committed and untouched by the failure,
and the missing notification is recoverable — see Reconciliation below. Proven by
`monitoring-outcome-isolation.integration.test.ts`, which forces `createNotificationOnce`/
`upsertGroupedNotification` to throw via a `vi.mock` wrapper around the real module and asserts
every piece of monitoring truth is unaffected.

## Idempotency and dedupe

`notifications` gained (migration 0030): `category`, `priority`, `source_type`, `source_id`,
`dedupe_key`, `action_path`, `occurrence_count`, `last_occurred_at`, `model_version`. A unique index
on `(user_id, dedupe_key)` enforces at the D1 level — not just in application code, which is unsafe
under concurrent retries — that one logical source event produces at most one notification per user.

Two write paths, chosen per notification shape:

- **`createNotificationOnce`** — `INSERT ... ON CONFLICT (user_id, dedupe_key) DO NOTHING`, for
  single-fire types (`critical_policy_change`, `high_severity_policy_change`, `registry_drift`,
  `monitoring_paused`). `dedupeKey` embeds a globally unique source id (a `domain_change_events.id`
  or a `failure_episode_id`), so a retry is always the identical logical event.
- **`upsertGroupedNotification`** — select-then-insert-or-conditionally-update, for
  `resource_failure`'s incident-level grouping. `occurrenceCount` is always the authoritative
  current value (`domains.consecutive_failure_count`), never an incremented delta — re-applying the
  same count is a true no-op (no re-surfacing as unread); a strictly higher count updates in place
  and clears `read_at`. This sidesteps the "is this a retry or a genuinely new occurrence"
  ambiguity entirely, since the value itself is idempotent by construction.

## Reconciliation

`apps/web/src/lib/notification-reconciliation.ts`'s `reconcileMissingPolicyChangeNotifications`
scans recent (`lookbackMinutes`, default 180) high-attention `domain_change_events` rows, checks
each against `notifications` by `(source_type, source_id)`, and calls the same
`buildPolicyChangeNotificationIntent` + `createNotificationOnce` monitoring.ts itself uses — so a
recovered notification is byte-identical to what would have been created synchronously. Runs as its
own scheduled job (`worker.ts`'s `runNotificationReconciliationJob`), independent
`ctx.waitUntil()`/`scheduled_job_runs` row, so a reconciliation failure can never affect monitoring
and vice versa. Bounds and backfill policy: `docs/product/PHASE_10_NOTIFICATION_RECONCILIATION_BACKFILL_POLICY.md`.

`resource_failure`/`monitoring_paused` are deliberately **not** reconciled — they're derived from
live domain state (`failure_episode_id`/`consecutiveFailureCount`), which is already authoritative
and self-consistent by construction (every mutation is a single atomic UPDATE); there is no
"missing source event" to recover, only a possibly-missing notification row for the _next_ failure,
which the next scheduled sweep naturally re-attempts.

## Target vs. platform failure classification

`ScanFailureClassification = "target" | "platform"` (`monitoring.ts`). `runMonitoringSweep` assigns
it structurally, not by inspecting error content: the `else` branch (a completed audit run with a
non-success status) is always `"target"`; the outer `catch` (an exception thrown before any scan
result exists) is always `"platform"`. `recordScheduledScanOutcome`'s `platformFailure: true` branch
touches only `lastScanId`/`lastScanAt` — never `consecutiveFailureCount`, `failureEpisodeId`, or
`monitoringState`. A platform failure produces no user-facing notification (internal `console.error`
only) and never advances toward the pause threshold, however many times it recurs — proven by
`monitoring-outcome-isolation.integration.test.ts`'s "repeated platform-side failures never reach
the pause threshold" test.
