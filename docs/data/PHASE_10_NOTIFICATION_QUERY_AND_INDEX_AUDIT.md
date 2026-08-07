# Phase 10 — Notification Query and Index Audit

## New indexes (migration 0030)

| Index                                    | Columns                                 | Serves                                                                                                                                                                                                                                                                                          |
| ---------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idx_notifications_user_dedupe` (unique) | `notifications(user_id, dedupe_key)`    | Idempotent insert/upsert (`createNotificationOnce`, `upsertGroupedNotification`) — the D1-level enforcement §13 requires. `dedupe_key IS NULL` rows (legacy, pre-Phase-10) are exempt automatically (SQLite never treats two NULLs as equal in a unique index), no partial-index clause needed. |
| `idx_notifications_source`               | `notifications(source_type, source_id)` | Reconciliation's "does a notification already exist for this event" check, and Super Admin per-source-type counts.                                                                                                                                                                              |
| `idx_domain_change_events_observed_at`   | `domain_change_events(observed_at)`     | Reconciliation's bounded recent-events scan — a table-wide time-ordered query the existing domain-scoped `idx_domain_change_events_domain_observed` (migration 0026) does not serve.                                                                                                            |

## Query plans (EXPLAIN QUERY PLAN, local D1)

- **`listNotifications`** (existing `idx_notifications_user_id`/`idx_notifications_read_at`,
  unchanged): `SEARCH notifications USING INDEX idx_notifications_user_id (user_id=?)` — Phase 10's
  new `category`/`domainIds` filter conditions apply as additional `WHERE` predicates evaluated
  against the already-selected row set, not separate index lookups; no N+1 introduced (confirmed:
  the group-filter's domain-id resolution in `pages/api/notifications/index.ts` is one query, not
  one per domain).
- **`createNotificationOnce`/`upsertGroupedNotification`'s existing-row check**:
  `SEARCH notifications USING INDEX idx_notifications_user_dedupe (user_id=? AND dedupe_key=?)` —
  the new unique index directly serves this lookup, not a table scan.
- **`reconcileMissingPolicyChangeNotifications`'s candidate-event scan**:
  `SEARCH domain_change_events USING INDEX idx_domain_change_events_observed_at (observed_at>?)`,
  then per-candidate `SEARCH notifications USING INDEX idx_notifications_source (source_type=? AND
source_id=?)` — both indexed, bounded by `lookbackMinutes`/`batchSize`, never a full table scan.
- **`countLongOverdueActiveDomains`**: reuses the existing `monitoringState`/`deletedAt`/`nextScanAt`
  predicate shape `claimDueDomains` already uses — no new index needed, matches Phase 11's own
  `idx_domains_owner_monitoring`-adjacent query pattern.

## Retention impact

No new retention obligation — `notifications` retention remains an open recommendation (RISK-006,
Phase 11), unchanged by Phase 10's additive columns. The new columns do not themselves grow
unboundedly per row (fixed-width per notification), so they don't change the retention-urgency
calculus.

## D1 read/write cost

Notification write paths add at most one extra SELECT (`upsertGroupedNotification`'s
existing-row check) beyond the pre-Phase-10 single INSERT — a small, bounded, indexed addition, not
a materially different write-amplification profile. Reconciliation is a wholly separate, independently
scheduled job with its own bounded budget (§27's "separate bounded budget" requirement) — it does not
run inside the monitoring sweep's own per-domain loop and therefore cannot reduce monitoring scan
throughput.
