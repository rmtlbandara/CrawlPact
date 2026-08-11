# Phase 14 Scheduled-Job Isolation Decision

**Level 4 document.** Reassesses `docs/operations/PHASE_11_SCHEDULED_JOB_SEPARATION_DECISION.md`
now that a fifth job (`evaluateOperationalAlerts`, Phase 14) has been added to the same
`scheduled()` invocation.

## Current state (real, from `wrangler.jsonc` and `worker.ts`)

Still one Cron Trigger, `"0 3 * * *"` (daily, 03:00 UTC) — unchanged. Five jobs now fire from that
one invocation via separate `ctx.waitUntil()` calls: `runRetentionJob` (unconditional),
`runScheduledDowngradesJob` (gated on `BILLING_ENABLED`), `runMonitoringJob` +
`runNotificationReconciliationJob` (gated on `AUDIT_ENGINE_ENABLED`), and
`evaluateOperationalAlerts` (unconditional, new this phase).

## Should monitoring, retention, notification reconciliation, monitoring reconciliation, and health

## evaluation remain in one scheduled invocation, or be separated?

**Remain bundled.** Applying the separation principle (§39 — separate only when one job can starve
another, one failure prevents another from completing, CPU/resource budgets conflict, different
schedules are required, or operational diagnosis is materially improved):

- `evaluateOperationalAlerts` only _reads_ already-committed data (job runs, security events,
  webhook events, capacity snapshot) — it writes nothing that any other job depends on, and no
  other job reads from `operational_alerts`. It cannot starve or be starved by the others in any
  way that matters (its own queries are simple, bounded `COUNT(*)` aggregations, not the kind of
  cost that competes meaningfully with a monitoring sweep's scan work).
- It requires no different schedule — evaluating alerts once a day, right after the jobs whose
  output it reads, is exactly the cadence that makes sense; a separate, more-frequent trigger for
  it alone would not improve alert freshness in any way that matters given the underlying jobs
  themselves only run daily.
- Its own failure is already isolated the same way every other job's is: wrapped in its own
  try/catch (`worker.ts`), logged via `console.error`, and never propagated to or dependent on any
  other job's `ctx.waitUntil()`.
- Operational diagnosis is not materially improved by splitting it out — if anything, keeping it in
  the same invocation as the signals it reads means "did today's evaluation run" and "did today's
  jobs run" are answered by looking at the same `scheduled_job_runs`-adjacent evidence together.

**Monitoring reconciliation** named in the Phase 14 prompt's own wording does not exist as a
separate concept from notification reconciliation in this codebase — Phase 10's monitoring-state
model (`due`/`overdue`/`paused`/`active`, backoff) is self-healing by construction (an atomic
conditional `UPDATE` claim-lock, no separate lock table, no drift that needs a reconciliation pass
— see `docs/operations/PHASE_14_STATUS_OPERATIONS_BASELINE.md` "Existing Cron jobs"). Only
_notification_ reconciliation exists as a distinct repair pass, and it is already its own separate
job/try/catch/`scheduled_job_runs` row, unchanged by this phase.

## Reaffirmed from Phase 11

The Phase 11 decision's own reasoning (bounded per-job cost via chunking/batching, low real volume,
1 of 5 Free-plan Cron Trigger slots used, 4 free) is unchanged and still applies — re-read in full
at `docs/operations/PHASE_11_SCHEDULED_JOB_SEPARATION_DECISION.md`, not repeated here. The concrete
trigger for revisiting (retention/plan-change durations regularly overlapping with monitoring sweep
durations, or real volume approaching `CLOUDFLARE_UPGRADE_TRIGGERS.md`'s thresholds) is unchanged
and now additionally observable via `detectSchedulerAnomalies`'s `long_execution`/`overlapping`
anomaly types, which — as of this phase — are finally reachable against real data (the
`scheduled_job_runs` "running"-row fix, see baseline doc).

## What this phase changed as a direct result

- Added `evaluateOperationalAlerts` to the same bundled invocation, reasoned through the same
  separation principle rather than assumed.
- Did not add a second Cron Trigger — still 1 of 5 Free-plan slots used.
