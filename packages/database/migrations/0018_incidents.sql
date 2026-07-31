-- Incident tracking (public status page + Super Admin management). See
-- docs/architecture/INCIDENT_TRACKING_SYSTEM_DESIGN.md for the full design.
-- Purely additive: two new tables, no changes to any existing table.
--
-- Actor references (created_by_user_id) are nullable with ON DELETE SET NULL
-- from the start, matching the fix migrations 0013-0015 had to apply
-- retroactively elsewhere — deleting the administrator who created an
-- incident must never block the daily account-deletion job, and the
-- incident record itself is retained regardless.
CREATE TABLE incidents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  public_summary TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('minor', 'major', 'critical')),
  status TEXT NOT NULL DEFAULT 'investigating'
    CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  affected_components TEXT NOT NULL, -- JSON array of canonical component keys (lib/status/components.ts)
  is_scheduled_maintenance INTEGER NOT NULL DEFAULT 0 CHECK (is_scheduled_maintenance IN (0, 1)),
  is_public INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0, 1)),
  starts_at TEXT NOT NULL,
  resolved_at TEXT,
  created_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_incidents_status ON incidents (status);
CREATE INDEX idx_incidents_is_public ON incidents (is_public);

-- Append-only update timeline per incident — same rowid-primary-key
-- convention as admin_audit_logs/security_events (never updated or deleted).
-- incident_id is a structural parent-child reference to a row this system
-- itself owns (not a user actor), so ON DELETE CASCADE is correct here and
-- is not the same pattern as the user-actor references above.
CREATE TABLE incident_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id TEXT NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
  status TEXT NOT NULL
    CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  message TEXT NOT NULL,
  created_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_incident_updates_incident_id ON incident_updates (incident_id);
