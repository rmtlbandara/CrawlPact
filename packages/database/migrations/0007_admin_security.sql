-- Administration, security, and operations (SRS §28, §33).
-- Append-only tables (admin_audit_logs, security_events, product_events,
-- scheduled_job_runs) use an INTEGER rowid primary key for cheap natural
-- ordering; they are never updated or deleted by application code.
CREATE TABLE admin_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  administrator_user_id TEXT NOT NULL REFERENCES users (id),
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  previous_state TEXT, -- JSON
  new_state TEXT, -- JSON
  reason TEXT NOT NULL,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_admin_audit_logs_administrator_user_id ON admin_audit_logs (administrator_user_id);
CREATE INDEX idx_admin_audit_logs_created_at ON admin_audit_logs (created_at);

CREATE TABLE blocked_targets (
  id TEXT PRIMARY KEY,
  target_pattern TEXT NOT NULL UNIQUE, -- hostname or hostname suffix
  reason TEXT NOT NULL,
  blocked_by_user_id TEXT NOT NULL REFERENCES users (id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  removed_at TEXT
);

CREATE TABLE security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('unsafe_scan_attempt', 'rate_limit', 'auth_failure', 'recovery_code_failure', 'suspicious_session', 'invalid_paddle_signature', 'replayed_webhook', 'admin_security_action')
  ),
  user_id TEXT REFERENCES users (id),
  ip_hash TEXT,
  target TEXT,
  details TEXT, -- JSON
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_security_events_event_type ON security_events (event_type);
CREATE INDEX idx_security_events_created_at ON security_events (created_at);

CREATE TABLE scheduled_job_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_name TEXT NOT NULL,
  cron_expression TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  domains_selected INTEGER NOT NULL DEFAULT 0,
  scans_created INTEGER NOT NULL DEFAULT 0,
  scans_completed INTEGER NOT NULL DEFAULT 0,
  scans_failed INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at TEXT
);

CREATE INDEX idx_scheduled_job_runs_job_name ON scheduled_job_runs (job_name);

CREATE TABLE runtime_configuration (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  value_type TEXT NOT NULL CHECK (value_type IN ('integer', 'boolean', 'string')),
  description TEXT NOT NULL,
  min_value INTEGER,
  max_value INTEGER,
  updated_by_user_id TEXT REFERENCES users (id),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE internal_user_notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users (id),
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_internal_user_notes_user_id ON internal_user_notes (user_id);

CREATE TABLE product_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name TEXT NOT NULL,
  user_id TEXT REFERENCES users (id),
  anonymous_id TEXT,
  properties TEXT, -- JSON, no unnecessary personal data (SRS §28.13)
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_product_events_event_name ON product_events (event_name);
CREATE INDEX idx_product_events_created_at ON product_events (created_at);
