-- Phase 14 (Status, Operations and Service Reliability).
--
-- First-party, deduplicated internal operational alerting (§26/§32/§33 of
-- the Phase 14 prompt) -- no third-party paging/alerting service is added.
-- One persistent failure condition produces one logical row, kept updated
-- in place (last_seen_at, occurrence_count) rather than a new row per health
-- evaluation, so this table stays small regardless of how often
-- evaluateOperationalAlerts() runs. Never publicly readable -- consumed only
-- by /admin/operations and the Super Admin API. See
-- docs/operations/OPERATIONAL_ALERT_MODEL.md.
CREATE TABLE operational_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_key TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  source TEXT NOT NULL,
  detail TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  resolved_at TEXT,
  acknowledged_at TEXT,
  acknowledged_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);

-- The evaluator's own upsert query is "the unresolved row for this exact
-- alert_key, if one exists" -- this partial-unique index enforces that
-- invariant at the database level (SQLite/D1 supports partial indexes) so a
-- concurrent evaluation can never create two open rows for the same
-- condition.
CREATE UNIQUE INDEX idx_operational_alerts_open_key
  ON operational_alerts(alert_key)
  WHERE resolved_at IS NULL;

CREATE INDEX idx_operational_alerts_resolved_at ON operational_alerts(resolved_at);
