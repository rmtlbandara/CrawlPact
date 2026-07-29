-- Fixes a real bug: after a user removes (soft-deletes) a saved domain, they
-- could never save that same domain again. `domains` carried a table-level
-- `UNIQUE (owner_user_id, canonical_origin)` from migration 0005 that applies
-- to every row regardless of `deleted_at`. `softDeleteDomain`
-- (apps/web/src/lib/domains.ts) only sets `deleted_at`, it never removes the
-- row, so the soft-deleted row kept occupying that unique slot. The app-level
-- duplicate check (`findExistingByOrigin`) filters to `deleted_at IS NULL`,
-- so it saw no conflict and proceeded to INSERT -- which then hit the real,
-- non-partial unique index and threw a raw SQLITE_CONSTRAINT error. That
-- error isn't an ApiError, so it fell into the generic catch-all in
-- apps/web/src/lib/json-response.ts and surfaced to the user as "Could not
-- save this domain -- Something went wrong."
--
-- Fix: replace the blanket unique constraint with a partial unique index
-- that only applies to live rows (`WHERE deleted_at IS NULL`), matching the
-- pattern already used for registry_versions/ruleset_versions' single-active
-- partial index (migration 0009). A user can now re-save a domain they
-- previously removed; historical soft-deleted rows no longer block it.
--
-- SQLite can't drop a table-level UNIQUE constraint with ALTER TABLE, so this
-- requires the documented rebuild procedure. `domains` is itself referenced
-- by scans.domain_id and scan_diffs.domain_id (both ON DELETE CASCADE), so
-- this uses `PRAGMA defer_foreign_keys=ON`, not `foreign_keys=OFF` -- see
-- migrations 0013-0015 and docs/data/MIGRATION_POLICY.md for why: D1 runs a
-- migration file as one implicit transaction, and `foreign_keys` changes are
-- silently ignored mid-transaction, so `OFF` can pass against a throwaway
-- sqlite3 file and still fail against real D1 once dependent rows exist.

PRAGMA defer_foreign_keys=ON;

CREATE TABLE domains_new (
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
  deleted_at TEXT
);
INSERT INTO domains_new SELECT * FROM domains;
DROP TABLE domains;
ALTER TABLE domains_new RENAME TO domains;

CREATE UNIQUE INDEX idx_domains_owner_origin_live ON domains (owner_user_id, canonical_origin) WHERE deleted_at IS NULL;
CREATE INDEX idx_domains_owner_user_id ON domains (owner_user_id);
CREATE INDEX idx_domains_group_id ON domains (group_id);
CREATE INDEX idx_domains_next_scan_at ON domains (next_scan_at);
CREATE INDEX idx_domains_monitoring_state ON domains (monitoring_state);
