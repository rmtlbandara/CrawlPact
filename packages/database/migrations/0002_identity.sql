-- Identity and passkey authentication (SRS §24, ADR-0004).
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending_deletion')),
  plan_id TEXT NOT NULL DEFAULT 'free' REFERENCES plans (id),
  is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  deletion_requested_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT
);

CREATE INDEX idx_users_status ON users (status);
CREATE INDEX idx_users_plan_id ON users (plan_id);

CREATE TABLE passkey_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  sign_count INTEGER NOT NULL DEFAULT 0,
  transports TEXT, -- JSON array of transport hints, informational only
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_used_at TEXT,
  removed_at TEXT
);

CREATE INDEX idx_passkey_credentials_user_id ON passkey_credentials (user_id);

CREATE TABLE recovery_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_recovery_codes_user_id ON recovery_codes (user_id);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  user_agent TEXT,
  ip_hash TEXT,
  is_admin_session INTEGER NOT NULL DEFAULT 0 CHECK (is_admin_session IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  last_authenticated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revoked_at TEXT
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);

CREATE TABLE admin_roles (
  id TEXT PRIMARY KEY, -- 'super_admin' | 'registry_manager' | 'billing_viewer' | 'support_viewer' | 'security_administrator' | 'content_manager'
  name TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE admin_role_assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES admin_roles (id),
  assigned_by_user_id TEXT REFERENCES users (id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revoked_at TEXT,
  UNIQUE (user_id, role_id)
);

CREATE INDEX idx_admin_role_assignments_user_id ON admin_role_assignments (user_id);
