-- Notifications, feeds, sharing, and platform notices (SRS §23, §26).
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  domain_id TEXT REFERENCES domains (id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (
    type IN ('critical_policy_change', 'high_severity_policy_change', 'new_crawler', 'crawler_purpose_change', 'registry_drift', 'resource_failure', 'monitoring_paused', 'subscription_issue', 'shared_report_expiry', 'platform_notice')
  ),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_notifications_user_id ON notifications (user_id);
CREATE INDEX idx_notifications_read_at ON notifications (read_at);

CREATE TABLE feed_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revoked_at TEXT
);

CREATE INDEX idx_feed_tokens_user_id ON feed_tokens (user_id);

CREATE TABLE shared_reports (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL REFERENCES scans (id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  agency_branding TEXT, -- JSON, optional
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revoked_at TEXT
);

CREATE INDEX idx_shared_reports_owner_user_id ON shared_reports (owner_user_id);

CREATE TABLE system_notices (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'information' CHECK (severity IN ('information', 'warning', 'critical')),
  is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  published_at TEXT,
  created_by_user_id TEXT REFERENCES users (id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
