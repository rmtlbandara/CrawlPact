# Service Level Indicators

**Level 2 document.** Phase 14. Internal reliability measurements only — never published as a
customer-facing SLA. See `docs/operations/INTERNAL_SERVICE_OBJECTIVES.md` for the internal targets
built on top of these, and `docs/product/PHASE_14_PUBLIC_UPTIME_PERCENTAGE_DECISION.md` for why none
of this is published as a percentage yet.

All ratios are computed by `apps/web/src/lib/admin/operations.ts`'s `getReliabilityTrends()`,
surfaced at `/admin/operations` for four bounded windows (1h/24h/7d/30d — §102's own required
window set), and rendered as `N / D — P%`, never a bare percentage; a denominator of 0 renders as
"Insufficient historical data" (the same low-volume-data rule Phase 13 established for product
analytics).

## Monitoring timeliness

**Definition**: scheduled scans (`scans.triggered_by = 'scheduled'`) that completed
(`status IN ('completed', 'completed_with_warnings')`) within the window ÷ all scheduled scans
started within the window.

**Source**: `scans` table, filtered on `started_at`.

**Limitation**: this measures scan _completion_, not whether the scan happened inside its intended
per-plan cadence window (monthly/weekly) — that's a separate, harder question already partially
answered by `capacity.monitoring.longOverdueActiveDomainCount` (a real overdue-domain count, not a
ratio). Monitoring truth itself remains entirely owned by Phase 10 (`lib/monitoring.ts`); this
ratio is a read-only reliability lens on top of it, never a second source of truth.

## Job reliability

**Definition**: `scheduled_job_runs` rows with `status = 'completed'` within the window ÷ all
`scheduled_job_runs` rows started within the window (across all job types — monitoring, retention,
notification reconciliation, scheduled downgrades).

**Source**: `scheduled_job_runs`, filtered on `started_at`.

**Limitation**: `completed_with_errors` (a genuine per-category retention failure that didn't abort
the whole job) counts as a non-success here, same as `failed` — deliberately conservative, matching
`detectSchedulerAnomalies`'s own treatment of that status.

## Billing-processing reliability

**Definition**: `webhook_events` with `status = 'processed'` within the window ÷ all
`webhook_events` received within the window.

**Source**: `webhook_events`, filtered on `received_at`.

**Limitation**: does not distinguish "Paddle sent a malformed event" from "our processing failed" —
both count as non-success. `retrying`/`pending` rows also count as non-success in the denominator's
numerator gap, which is conservative (a webhook still in flight is not yet a confirmed success).

## Authentication availability

**Definition**: not currently expressed as a ratio (no "attempted system-level auth-health check"
exists to form a denominator) — reported as a raw count (`authFailureCount`) per window instead.
A true availability ratio would need a synthetic auth-health check (§13's "Authentication
configuration health"), not built this phase — see `PUBLIC_COMPONENT_SIGNAL_MAPPING.md`.

## Job reliability by job (not yet broken out)

The `jobReliability` ratio above is combined across every job type. A per-job-type breakdown was
considered and not built — `detectSchedulerAnomalies()` already gives a real per-job anomaly view
(`/admin/operations`'s "Scheduler anomalies" section), which was judged sufficient for now rather
than adding a second, overlapping per-job ratio table.
