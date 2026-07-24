-- Versioned AI crawler registry (SRS §17). Releases are immutable once
-- published; historical scans keep the registry/ruleset version they used.
CREATE TABLE crawler_operators (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  website_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE crawlers (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL REFERENCES crawler_operators (id),
  name TEXT NOT NULL,
  user_agent_token TEXT NOT NULL,
  alternative_tokens TEXT, -- JSON array
  purpose TEXT NOT NULL CHECK (
    purpose IN ('search', 'training', 'user_triggered', 'agent', 'advertising_validation', 'research', 'mixed', 'unknown')
  ),
  description TEXT NOT NULL,
  official_source_url TEXT NOT NULL,
  lifecycle_status TEXT NOT NULL DEFAULT 'unverified' CHECK (
    lifecycle_status IN ('active', 'deprecated', 'replaced', 'unverified', 'retired')
  ),
  replacement_crawler_id TEXT REFERENCES crawlers (id),
  published_ip_info TEXT, -- JSON, optional
  notes TEXT,
  first_verified_at TEXT,
  last_verified_at TEXT,
  approved_by_user_id TEXT REFERENCES users (id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX idx_crawlers_user_agent_token ON crawlers (user_agent_token);
CREATE INDEX idx_crawlers_operator_id ON crawlers (operator_id);
CREATE INDEX idx_crawlers_purpose ON crawlers (purpose);
CREATE INDEX idx_crawlers_lifecycle_status ON crawlers (lifecycle_status);

CREATE TABLE registry_versions (
  id TEXT PRIMARY KEY,
  version_label TEXT NOT NULL UNIQUE,
  changelog TEXT NOT NULL,
  published_by_user_id TEXT REFERENCES users (id),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE registry_version_entries (
  id TEXT PRIMARY KEY,
  registry_version_id TEXT NOT NULL REFERENCES registry_versions (id) ON DELETE CASCADE,
  crawler_id TEXT NOT NULL REFERENCES crawlers (id),
  snapshot TEXT NOT NULL, -- JSON snapshot of the crawler record at publish time (immutable)
  UNIQUE (registry_version_id, crawler_id)
);

CREATE INDEX idx_registry_version_entries_registry_version_id ON registry_version_entries (registry_version_id);

CREATE TABLE ruleset_versions (
  id TEXT PRIMARY KEY,
  version_label TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  published_by_user_id TEXT REFERENCES users (id),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
