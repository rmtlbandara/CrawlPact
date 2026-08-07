-- Phase 10 (Notification Channels and Monitoring Reliability).
--
-- Additive only. Every column/index here supports either notification
-- idempotency/dedupe (docs/architecture/NOTIFICATION_RELIABILITY_ARCHITECTURE.md)
-- or the domain-level failure-episode grouping used to collapse repeated
-- resource_failure notifications into one row
-- (docs/product/NOTIFICATION_FATIGUE_AND_GROUPING_POLICY.md). No existing
-- table is destructively altered; every pre-existing `notifications` row
-- keeps every new column NULL/default and is treated as a legacy row —
-- never backfilled, never recreated (docs/product/
-- PHASE_10_NOTIFICATION_RECONCILIATION_BACKFILL_POLICY.md).

-- Notification dedupe/source/grouping model.
ALTER TABLE notifications ADD COLUMN category TEXT;
ALTER TABLE notifications ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'
  CHECK (priority IN ('critical', 'high', 'normal', 'informational'));
ALTER TABLE notifications ADD COLUMN source_type TEXT;
ALTER TABLE notifications ADD COLUMN source_id TEXT;
ALTER TABLE notifications ADD COLUMN dedupe_key TEXT;
ALTER TABLE notifications ADD COLUMN action_path TEXT;
ALTER TABLE notifications ADD COLUMN occurrence_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE notifications ADD COLUMN last_occurred_at TEXT;
ALTER TABLE notifications ADD COLUMN model_version TEXT;

-- Idempotency: at most one notification per (user, dedupe_key). SQLite never
-- treats two NULLs as equal in a unique index, so every pre-Phase-10 legacy
-- row (dedupe_key IS NULL) is automatically exempt — no partial-index WHERE
-- clause required.
CREATE UNIQUE INDEX idx_notifications_user_dedupe ON notifications (user_id, dedupe_key);

-- Reconciliation's "does a notification already exist for this source event"
-- check, and Super Admin's per-source-type reliability counts.
CREATE INDEX idx_notifications_source ON notifications (source_type, source_id);

-- Reconciliation's bounded "recent domain_change_events" scan
-- (apps/web/src/lib/notification-reconciliation.ts) needs a
-- table-wide time-ordered index — the existing
-- idx_domain_change_events_domain_observed (migration 0026) is domain-scoped
-- and does not serve this query shape.
CREATE INDEX idx_domain_change_events_observed_at ON domain_change_events (observed_at);

-- Repeated-failure grouping (docs/architecture/NOTIFICATION_RELIABILITY_ARCHITECTURE.md,
-- "incident-level notification"): a stable identifier for a domain's
-- *current* consecutive target-failure streak, so failure #2, #3, #4... all
-- update the same resource_failure notification row instead of creating a
-- new one each time. Minted on the first failure of a new streak, cleared to
-- NULL on the next success (recordScheduledScanOutcome in
-- apps/web/src/lib/domains.ts).
ALTER TABLE domains ADD COLUMN failure_episode_id TEXT;
