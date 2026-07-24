-- Same class of bug as migrations 0013/0014, found by the same Part 3
-- Step 21 verification pass, across every remaining "who did this" column
-- referencing users(id) with no ON DELETE behavior (defaulting to
-- SQLite's NO ACTION). Any of these would throw SQLITE_CONSTRAINT_FOREIGNKEY
-- and abort the entire daily retention job the first time an account with
-- a historical row in one of these tables was purged -- most plausibly a
-- customer's own past manual/scheduled scans (scans.triggered_by_user_id),
-- or an administrator's account being offboarded after they had ever
-- approved a crawler, published a registry/ruleset release, blocked a
-- target, written an audit log entry, an internal note, a system notice,
-- resolved a security event, or changed a runtime setting -- all real,
-- ordinary Super Admin actions built in Part 3.
--
-- Fix, applied identically to every column below: ON DELETE SET NULL
-- instead of the implicit NO ACTION. The historical record (a scan, an
-- audit log entry, a published registry release, a blocked-target
-- decision) is preserved -- exactly matching SRS §28's requirement that
-- these are an immutable operational/audit trail -- only the specific
-- actor's identity link is severed once their account no longer exists.
-- Columns that were NOT NULL (temporary_entitlements.granted_by_user_id,
-- admin_audit_logs.administrator_user_id, blocked_targets.blocked_by_user_id,
-- internal_user_notes.author_user_id) become nullable, since a value of
-- NULL is now a legitimate, meaningful state ("the actor's account was
-- later deleted"), not a data-quality error.
--
-- Note on FK handling: this file intentionally uses
-- `PRAGMA defer_foreign_keys=ON`, not `PRAGMA foreign_keys=OFF`. D1 (both
-- `wrangler d1 execute --file` and `d1 migrations apply`) runs an entire
-- migration file as a single implicit transaction, and SQLite silently
-- no-ops any attempt to change the `foreign_keys` pragma while a
-- transaction is already open -- confirmed empirically: the first version
-- of this migration, using `foreign_keys=OFF`, applied cleanly to a fresh
-- throwaway sqlite3 database (autocommit, no wrapping transaction) but
-- failed with SQLITE_CONSTRAINT_FOREIGNKEY against real local dev D1,
-- because every one of these 12 tables is itself a real FK parent to other
-- tables with real rows (e.g. crawlers <- registry_version_entries, scans
-- <- scan_resources/findings), so the DROP TABLE step failed with
-- enforcement silently still active. `defer_foreign_keys=ON` IS honored
-- mid-transaction (it is specifically designed to be) and defers every FK
-- check in this file to the final implicit COMMIT, by which point each
-- rebuilt table exists again under its original name with valid data, so
-- every deferred check passes. It auto-resets at COMMIT, so no explicit
-- "OFF" is needed afterwards.

PRAGMA defer_foreign_keys=ON;

-- crawlers.approved_by_user_id
CREATE TABLE crawlers_new (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL REFERENCES crawler_operators (id),
  name TEXT NOT NULL,
  user_agent_token TEXT NOT NULL,
  alternative_tokens TEXT,
  purpose TEXT NOT NULL CHECK (
    purpose IN ('search', 'training', 'user_triggered', 'agent', 'advertising_validation', 'research', 'mixed', 'unknown')
  ),
  description TEXT NOT NULL,
  official_source_url TEXT NOT NULL,
  lifecycle_status TEXT NOT NULL DEFAULT 'unverified' CHECK (
    lifecycle_status IN ('active', 'deprecated', 'replaced', 'unverified', 'retired')
  ),
  replacement_crawler_id TEXT REFERENCES crawlers (id),
  published_ip_info TEXT,
  notes TEXT,
  first_verified_at TEXT,
  last_verified_at TEXT,
  approved_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
INSERT INTO crawlers_new SELECT * FROM crawlers;
DROP TABLE crawlers;
ALTER TABLE crawlers_new RENAME TO crawlers;
CREATE UNIQUE INDEX idx_crawlers_user_agent_token ON crawlers (user_agent_token);
CREATE INDEX idx_crawlers_operator_id ON crawlers (operator_id);
CREATE INDEX idx_crawlers_purpose ON crawlers (purpose);
CREATE INDEX idx_crawlers_lifecycle_status ON crawlers (lifecycle_status);

-- registry_versions.published_by_user_id (also carries is_active, added by
-- migration 0009 -- preserved here along with its partial unique index)
CREATE TABLE registry_versions_new (
  id TEXT PRIMARY KEY,
  version_label TEXT NOT NULL UNIQUE,
  changelog TEXT NOT NULL,
  published_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1))
);
INSERT INTO registry_versions_new SELECT * FROM registry_versions;
DROP TABLE registry_versions;
ALTER TABLE registry_versions_new RENAME TO registry_versions;
CREATE UNIQUE INDEX idx_registry_versions_single_active ON registry_versions (is_active) WHERE is_active = 1;

-- ruleset_versions.published_by_user_id (also carries is_active, added by
-- migration 0009 -- preserved here along with its partial unique index)
CREATE TABLE ruleset_versions_new (
  id TEXT PRIMARY KEY,
  version_label TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  published_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1))
);
INSERT INTO ruleset_versions_new SELECT * FROM ruleset_versions;
DROP TABLE ruleset_versions;
ALTER TABLE ruleset_versions_new RENAME TO ruleset_versions;
CREATE UNIQUE INDEX idx_ruleset_versions_single_active ON ruleset_versions (is_active) WHERE is_active = 1;

-- admin_role_assignments.assigned_by_user_id
CREATE TABLE admin_role_assignments_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES admin_roles (id),
  assigned_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revoked_at TEXT,
  UNIQUE (user_id, role_id)
);
INSERT INTO admin_role_assignments_new SELECT * FROM admin_role_assignments;
DROP TABLE admin_role_assignments;
ALTER TABLE admin_role_assignments_new RENAME TO admin_role_assignments;
CREATE INDEX idx_admin_role_assignments_user_id ON admin_role_assignments (user_id);

-- temporary_entitlements.granted_by_user_id (was NOT NULL)
CREATE TABLE temporary_entitlements_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  granted_plan_id TEXT NOT NULL REFERENCES plans (id),
  reason TEXT NOT NULL,
  granted_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revoked_at TEXT
);
INSERT INTO temporary_entitlements_new SELECT * FROM temporary_entitlements;
DROP TABLE temporary_entitlements;
ALTER TABLE temporary_entitlements_new RENAME TO temporary_entitlements;
CREATE INDEX idx_temporary_entitlements_user_id ON temporary_entitlements (user_id);

-- scans.triggered_by_user_id -- the most likely of all of these to affect
-- an ordinary customer directly, since every manual re-scan sets it.
CREATE TABLE scans_new (
  id TEXT PRIMARY KEY,
  domain_id TEXT REFERENCES domains (id) ON DELETE CASCADE,
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('anonymous', 'manual', 'scheduled', 'admin')),
  triggered_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  target_input TEXT NOT NULL,
  canonical_origin TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('queued', 'running', 'completed', 'completed_with_warnings', 'incomplete', 'target_unavailable', 'blocked_for_safety', 'rate_limited', 'internal_failure')
  ),
  preset TEXT,
  registry_version_id TEXT REFERENCES registry_versions (id),
  ruleset_version_id TEXT REFERENCES ruleset_versions (id),
  score INTEGER,
  score_state TEXT NOT NULL DEFAULT 'incomplete' CHECK (score_state IN ('scored', 'incomplete')),
  external_request_count INTEGER NOT NULL DEFAULT 0,
  error_category TEXT,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at TEXT,
  recommended_additions TEXT -- JSON array, added by migration 0010
);
INSERT INTO scans_new SELECT * FROM scans;
DROP TABLE scans;
ALTER TABLE scans_new RENAME TO scans;
CREATE INDEX idx_scans_domain_id ON scans (domain_id);
CREATE INDEX idx_scans_status ON scans (status);
CREATE INDEX idx_scans_canonical_origin ON scans (canonical_origin);
CREATE INDEX idx_scans_started_at ON scans (started_at);

-- system_notices.created_by_user_id
CREATE TABLE system_notices_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'information' CHECK (severity IN ('information', 'warning', 'critical')),
  is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  published_at TEXT,
  created_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
INSERT INTO system_notices_new SELECT * FROM system_notices;
DROP TABLE system_notices;
ALTER TABLE system_notices_new RENAME TO system_notices;

-- security_events.user_id and .resolved_by_user_id
CREATE TABLE security_events_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('unsafe_scan_attempt', 'rate_limit', 'auth_failure', 'recovery_code_failure', 'suspicious_session', 'invalid_paddle_signature', 'replayed_webhook', 'admin_security_action')
  ),
  user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  ip_hash TEXT,
  target TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  resolved_at TEXT,
  resolved_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  resolution_note TEXT
);
INSERT INTO security_events_new SELECT * FROM security_events;
DROP TABLE security_events;
ALTER TABLE security_events_new RENAME TO security_events;
CREATE INDEX idx_security_events_event_type ON security_events (event_type);
CREATE INDEX idx_security_events_created_at ON security_events (created_at);
CREATE INDEX idx_security_events_resolved_at ON security_events (resolved_at);

-- admin_audit_logs.administrator_user_id (was NOT NULL)
CREATE TABLE admin_audit_logs_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  administrator_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  previous_state TEXT,
  new_state TEXT,
  reason TEXT NOT NULL,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
INSERT INTO admin_audit_logs_new SELECT * FROM admin_audit_logs;
DROP TABLE admin_audit_logs;
ALTER TABLE admin_audit_logs_new RENAME TO admin_audit_logs;
CREATE INDEX idx_admin_audit_logs_administrator_user_id ON admin_audit_logs (administrator_user_id);
CREATE INDEX idx_admin_audit_logs_created_at ON admin_audit_logs (created_at);
CREATE INDEX idx_admin_audit_logs_target ON admin_audit_logs (target);

-- blocked_targets.blocked_by_user_id (was NOT NULL)
CREATE TABLE blocked_targets_new (
  id TEXT PRIMARY KEY,
  target_pattern TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  blocked_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  removed_at TEXT
);
INSERT INTO blocked_targets_new SELECT * FROM blocked_targets;
DROP TABLE blocked_targets;
ALTER TABLE blocked_targets_new RENAME TO blocked_targets;

-- runtime_configuration.updated_by_user_id
CREATE TABLE runtime_configuration_new (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  value_type TEXT NOT NULL CHECK (value_type IN ('integer', 'boolean', 'string')),
  description TEXT NOT NULL,
  min_value INTEGER,
  max_value INTEGER,
  updated_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
INSERT INTO runtime_configuration_new SELECT * FROM runtime_configuration;
DROP TABLE runtime_configuration;
ALTER TABLE runtime_configuration_new RENAME TO runtime_configuration;

-- internal_user_notes.author_user_id (was NOT NULL) -- the note's *subject*
-- (user_id) keeps ON DELETE CASCADE unchanged: a note about a customer is
-- customer PII that should go when that customer's account is purged. Only
-- the *author* reference (an admin) is changed to survive.
CREATE TABLE internal_user_notes_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  author_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
INSERT INTO internal_user_notes_new SELECT * FROM internal_user_notes;
DROP TABLE internal_user_notes;
ALTER TABLE internal_user_notes_new RENAME TO internal_user_notes;
CREATE INDEX idx_internal_user_notes_user_id ON internal_user_notes (user_id);
