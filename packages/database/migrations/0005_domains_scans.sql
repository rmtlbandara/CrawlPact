-- Saved domains, scans, and findings (SRS §22, §23, §25).
CREATE TABLE domain_groups (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT
);

CREATE INDEX idx_domain_groups_owner_user_id ON domain_groups (owner_user_id);

CREATE TABLE domains (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  group_id TEXT REFERENCES domain_groups (id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  canonical_origin TEXT NOT NULL,
  original_input TEXT NOT NULL,
  preset TEXT NOT NULL DEFAULT 'maximum_ai_visibility' CHECK (
    preset IN ('maximum_ai_visibility', 'allow_search_block_training', 'publisher_protection', 'block_known_ai_crawlers')
  ),
  monitoring_state TEXT NOT NULL DEFAULT 'active' CHECK (monitoring_state IN ('active', 'paused')),
  monitoring_frequency TEXT NOT NULL DEFAULT 'none' CHECK (monitoring_frequency IN ('none', 'monthly', 'weekly')),
  last_scan_id TEXT,
  last_scan_at TEXT,
  next_scan_at TEXT,
  current_score INTEGER,
  consecutive_failure_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  UNIQUE (owner_user_id, canonical_origin)
);

CREATE INDEX idx_domains_owner_user_id ON domains (owner_user_id);
CREATE INDEX idx_domains_group_id ON domains (group_id);
CREATE INDEX idx_domains_next_scan_at ON domains (next_scan_at);
CREATE INDEX idx_domains_monitoring_state ON domains (monitoring_state);

CREATE TABLE scans (
  id TEXT PRIMARY KEY,
  domain_id TEXT REFERENCES domains (id) ON DELETE CASCADE, -- NULL for anonymous audits
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('anonymous', 'manual', 'scheduled', 'admin')),
  triggered_by_user_id TEXT REFERENCES users (id),
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
  completed_at TEXT
);

CREATE INDEX idx_scans_domain_id ON scans (domain_id);
CREATE INDEX idx_scans_status ON scans (status);
CREATE INDEX idx_scans_canonical_origin ON scans (canonical_origin);

CREATE TABLE scan_resources (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL REFERENCES scans (id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (
    resource_type IN ('robots_txt', 'llms_txt', 'llms_full_txt', 'rsl', 'content_signals', 'html_meta', 'http_headers', 'sitemap')
  ),
  requested_url TEXT NOT NULL,
  final_url TEXT,
  status_code INTEGER,
  content_type TEXT,
  content_size_bytes INTEGER,
  redirect_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  resource_hash TEXT,
  truncated INTEGER NOT NULL DEFAULT 0 CHECK (truncated IN (0, 1)),
  error_category TEXT,
  snapshot_text TEXT, -- bounded raw snapshot, see docs/data/DATA_RETENTION.md
  fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_scan_resources_scan_id ON scan_resources (scan_id);

CREATE TABLE scan_crawler_results (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL REFERENCES scans (id) ON DELETE CASCADE,
  crawler_id TEXT NOT NULL REFERENCES crawlers (id),
  result TEXT NOT NULL CHECK (
    result IN ('allowed', 'blocked', 'no_explicit_rule', 'mixed', 'unknown', 'resource_unavailable', 'not_evaluated')
  ),
  matched_rule TEXT,
  matched_line_number INTEGER,
  evaluation_explanation TEXT,
  source_resource_id TEXT REFERENCES scan_resources (id),
  UNIQUE (scan_id, crawler_id)
);

CREATE INDEX idx_scan_crawler_results_scan_id ON scan_crawler_results (scan_id);

CREATE TABLE findings (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL REFERENCES scans (id) ON DELETE CASCADE,
  finding_code TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'information')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  evidence TEXT NOT NULL, -- JSON: resource references, matched lines
  affected_crawler_id TEXT REFERENCES crawlers (id),
  business_impact TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  source_url TEXT,
  ruleset_version_id TEXT NOT NULL REFERENCES ruleset_versions (id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_findings_scan_id ON findings (scan_id);
CREATE INDEX idx_findings_severity ON findings (severity);
CREATE INDEX idx_findings_finding_code ON findings (finding_code);

CREATE TABLE scan_diffs (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL REFERENCES domains (id) ON DELETE CASCADE,
  previous_scan_id TEXT NOT NULL REFERENCES scans (id),
  current_scan_id TEXT NOT NULL REFERENCES scans (id),
  diff_type TEXT NOT NULL CHECK (diff_type IN ('website_drift', 'registry_drift', 'preset_change')),
  summary TEXT NOT NULL,
  details TEXT NOT NULL, -- JSON change set
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_scan_diffs_domain_id ON scan_diffs (domain_id);
