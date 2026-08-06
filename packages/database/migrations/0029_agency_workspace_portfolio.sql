-- Phase 9 (Agency Workspace and Portfolio Workflows).
--
-- Additive only. Every table/column here supports capabilities either newly
-- built this phase (CSV file import, bulk actions, a persistent agency
-- branding profile) or a narrow extension of an existing one (an optional
-- internal note on an existing domain group). No existing table is
-- destructively altered; SQLite's ALTER TABLE ADD COLUMN is the only
-- modification to a pre-existing table, matching every prior phase's
-- migration style in this repository (see e.g. 0027, 0028).
--
-- See docs/product/PHASE_09_WORKSPACE_MODEL_DECISION.md for why no
-- workspace/tenancy table is introduced, docs/product/PHASE_09_CLIENT_ENTITY_DECISION.md
-- for why no `clients` table is introduced (domain_groups already serves
-- that purpose), and docs/product/CSV_IMPORT_WORKFLOW.md for why import
-- processing needs only a job/row summary record, not a queue.

-- Optional internal note on a domain group (docs/product/PHASE_09_CLIENT_ENTITY_DECISION.md,
-- docs/product/DOMAIN_GROUP_MODEL.md). Length-bounded at the application layer
-- (500 chars); never included in CSV export by default; never sent to analytics.
ALTER TABLE domain_groups ADD COLUMN description TEXT;

-- Persistent, account-level agency branding defaults (docs/product/AGENCY_BRANDING_MODEL.md).
-- Deliberately minimal: only the two fields that are genuinely stable across every report an
-- agency shares (name, logo) are persisted here. `clientName`/`introText` stay per-share, in
-- shared_reports.agency_branding (migration 0006), since they describe one specific report, not
-- an account-wide default.
CREATE TABLE agency_brand_profiles (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  agency_name TEXT,
  logo_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- CSV batch-import job summary (docs/product/CSV_IMPORT_WORKFLOW.md). Not a queue — domain
-- creation happens synchronously within the confirm request (cheap, no outbound network call);
-- this table exists for idempotency (the unique index below), the user's own import history, and
-- Super Admin aggregate visibility (SRS §28), not to drive asynchronous execution. No raw CSV
-- content, no arbitrary source-row data, is ever stored here — see
-- docs/data/PHASE_09_IMPORT_AND_BULK_JOB_RETENTION.md.
CREATE TABLE portfolio_import_jobs (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  group_id TEXT REFERENCES domain_groups (id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (
    status IN ('completed', 'completed_with_errors', 'failed')
  ),
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  invalid_rows INTEGER NOT NULL DEFAULT 0,
  created_domains INTEGER NOT NULL DEFAULT 0,
  failed_domains INTEGER NOT NULL DEFAULT 0,
  monitoring_requested INTEGER NOT NULL DEFAULT 0 CHECK (monitoring_requested IN (0, 1)),
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at TEXT
);

-- Idempotency: a retried confirm submission with the same key returns the stored job/result
-- instead of re-processing (docs/product/CSV_IMPORT_WORKFLOW.md's "Idempotency" section).
CREATE UNIQUE INDEX idx_portfolio_import_jobs_owner_idempotency
  ON portfolio_import_jobs (owner_user_id, idempotency_key);

-- Import-job history list and Super Admin aggregate view, both filter/sort this way
-- (docs/data/PHASE_09_PORTFOLIO_QUERY_AND_INDEX_AUDIT.md).
CREATE INDEX idx_portfolio_import_jobs_owner_status
  ON portfolio_import_jobs (owner_user_id, status, created_at);

-- Per-row import outcome. Minimal by design (docs/product/CSV_IMPORT_WORKFLOW.md §Storage):
-- normalised origin (not the raw input line), a small fixed result/error code, and the resulting
-- domain_id when one was created — never the original arbitrary row or any unsupported column
-- value.
CREATE TABLE portfolio_import_rows (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES portfolio_import_jobs (id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  normalised_origin TEXT,
  result TEXT NOT NULL CHECK (
    result IN (
      'created',
      'duplicate_in_file',
      'already_saved',
      'invalid_domain',
      'private_target',
      'group_not_found',
      'monitoring_unavailable',
      'limit_exceeded',
      'batch_limit_exceeded',
      'field_too_long',
      'unsupported_field'
    )
  ),
  error_code TEXT,
  domain_id TEXT REFERENCES domains (id) ON DELETE SET NULL
);

CREATE INDEX idx_portfolio_import_rows_job_id ON portfolio_import_rows (job_id);

-- Bulk-action job summary (docs/product/BULK_ACTION_MODEL.md). Same rationale as
-- portfolio_import_jobs: idempotency + audit trail, not a queue — a bulk action's own execution
-- (group assignment, monitoring-flag toggles) is itself synchronous, bounded D1 writes with no
-- outbound network call.
CREATE TABLE bulk_action_jobs (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (
    action IN (
      'assign_group',
      'move_group',
      'remove_from_group',
      'enable_monitoring',
      'disable_monitoring',
      'pause_monitoring',
      'resume_monitoring'
    )
  ),
  status TEXT NOT NULL CHECK (
    status IN ('completed', 'completed_with_errors', 'failed')
  ),
  requested_count INTEGER NOT NULL DEFAULT 0,
  succeeded_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at TEXT
);

CREATE UNIQUE INDEX idx_bulk_action_jobs_owner_idempotency
  ON bulk_action_jobs (owner_user_id, idempotency_key);

CREATE INDEX idx_bulk_action_jobs_owner_status
  ON bulk_action_jobs (owner_user_id, status, created_at);

-- Portfolio table's group filter and the group-overview page's own domain list both filter this
-- exact pair; idx_domains_owner_origin_live (migration 0017) does not serve a group-scoped
-- lookup. See docs/data/PHASE_09_PORTFOLIO_QUERY_AND_INDEX_AUDIT.md.
CREATE INDEX idx_domains_owner_group ON domains (owner_user_id, group_id);

-- Portfolio summary's monitoring-state counts and the portfolio table's monitoring filter; no
-- existing index covers monitoring_state at all.
CREATE INDEX idx_domains_owner_monitoring ON domains (owner_user_id, monitoring_state);
