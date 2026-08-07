# Monitoring State Reconciliation

## Finding: no proactive repair job is implemented, and this is a deliberate, evidence-based decision

Phase 10's prompt anticipates a job that detects and repairs inconsistencies like "monitoring active
with no next scan" or "domain paused but state fields disagree." A careful read of the actual
mutation code (`apps/web/src/lib/domains.ts`'s `recordScheduledScanOutcome`) shows these specific
inconsistencies cannot arise from this codebase's normal operation:

- **Every monitoring-state mutation is a single atomic UPDATE statement** — `monitoringState` and
  `nextScanAt` are always set together in the same `.set({...})` call (success branch, target-failure
  branch, and the pause branch all do this). There is no multi-statement window in which they could
  diverge, since D1/Workers doesn't use interactive transactions here and none is needed — a single
  UPDATE is already atomic.
- **"Monitoring active with no next scan"** — `claimDueDomains`'s own WHERE clause already treats
  `next_scan_at IS NULL` as _due_, not broken (a brand-new, never-scanned domain). A paused domain
  with `next_scan_at = NULL` is excluded by the same query's `monitoringState = 'active'` filter. So
  this "inconsistency" is actually the correctly-designed baseline-pending state, not a bug to
  repair.
- **A crashed sweep mid-scan** (the one real failure mode where state could theoretically be left
  incomplete) already self-heals: `claimDueDomains` pushes `next_scan_at` into the claim-lock window
  (default 15 minutes) _before_ running the scan; if the process is killed before
  `recordScheduledScanOutcome` ever runs, the domain simply becomes due again once that window
  elapses, and the next daily sweep picks it up automatically — no additional code needed.

Building a repair job for inconsistencies that cannot occur would be dead code with no real target,
which this phase's own instructions caution against ("do not add architectural complexity without
measurable need").

## What Phase 10 adds instead: a measurement, not a repair

`countLongOverdueActiveDomains` (`apps/web/src/lib/notification-reconciliation.ts`) counts active
domains whose `next_scan_at` is more than 48 hours stale — the one scenario where the self-heal
_wouldn't_ be enough: the scheduler itself was degraded for an extended period (e.g.
`AUDIT_ENGINE_ENABLED` off, or a long `scheduler_paused`/`maintenance_mode` window), not a single
domain's state. Exposed via `GET /api/admin/capacity`'s
`monitoring.longOverdueActiveDomainCount` — see `MONITORING_HEALTH_STATE_MODEL.md`'s
`overdue_platform` state and `PHASE_10_MONITORING_RELIABILITY_THRESHOLDS.md` for the alert
threshold. If this number is ever nonzero, the fix is investigating why the scheduler itself
stalled, not repairing individual domain rows.

## Separation from notification reconciliation

Monitoring repair (the topic of this document — concluded unnecessary) and notification
reconciliation (`docs/architecture/NOTIFICATION_RELIABILITY_ARCHITECTURE.md`, real and implemented)
are kept conceptually and operationally separate:

- Monitoring repair would fix domain/scheduler state. Notification reconciliation fixes missing
  user-facing notifications derived from already-valid events.
- A missing notification is never "fixed" by rerunning a scan. A monitoring-state inconsistency
  (were one to exist) would never be "fixed" merely by creating a notification.
