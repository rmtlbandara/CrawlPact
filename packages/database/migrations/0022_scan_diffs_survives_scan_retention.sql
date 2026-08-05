-- Phase 11 (Database, Storage, Retention and Performance Hardening), RISK-005.
--
-- scan_diffs.previous_scan_id and current_scan_id reference scans(id) with no
-- ON DELETE clause -- unlike domain_id's ON DELETE CASCADE on the same table.
-- SQLite's default for an unqualified reference is NO ACTION, so if
-- purgeExpiredDomainScans (apps/web/src/lib/data-retention.ts) ever deletes a
-- scans row that a scan_diffs row still points to, that specific DELETE
-- throws SQLITE_CONSTRAINT_FOREIGNKEY -- the same bug class already fixed for
-- 14 other columns in migrations 0013-0015, but missed for this table because
-- scan_diffs was added later (migration 0005) and never re-audited afterward.
--
-- Fix: ON DELETE SET NULL, matching the established "the record survives,
-- only the reference is severed" pattern. The diff's summary/details text
-- remains a readable historical record ("what changed") even once one or
-- both of the scans it compared has aged out of retention; only the specific
-- scan-row link is severed. Both columns become nullable (they were NOT
-- NULL) since NULL is now a legitimate state, not a data-quality error.
-- domain_id's own ON DELETE CASCADE is unchanged -- a domain's diffs still
-- disappear when the domain itself is deleted, which is correct (nothing
-- about a deleted domain's change history should survive independently).
--
-- Deliberately NOT a cascading delete on previous_scan_id/current_scan_id:
-- the product intent is "keep describing what changed even after the old
-- scan ages out," not "delete the diff record whenever either scan is gone."
--
-- Uses PRAGMA defer_foreign_keys=ON, not foreign_keys=OFF -- see migrations
-- 0013-0015 and docs/data/MIGRATION_POLICY.md for why: D1 runs a migration
-- file as one implicit transaction, and `foreign_keys` pragma changes are
-- silently ignored mid-transaction, so `OFF` can pass against a throwaway
-- sqlite3 file and still fail against real D1 once dependent rows exist.
-- Nothing else references scan_diffs.id (confirmed by grep across every
-- migration and schema file), so this rebuild has no downstream FK impact.

PRAGMA defer_foreign_keys=ON;

CREATE TABLE scan_diffs_new (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL REFERENCES domains (id) ON DELETE CASCADE,
  previous_scan_id TEXT REFERENCES scans (id) ON DELETE SET NULL,
  current_scan_id TEXT REFERENCES scans (id) ON DELETE SET NULL,
  diff_type TEXT NOT NULL CHECK (diff_type IN ('website_drift', 'registry_drift', 'preset_change')),
  summary TEXT NOT NULL,
  details TEXT NOT NULL, -- JSON change set
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
INSERT INTO scan_diffs_new SELECT * FROM scan_diffs;
DROP TABLE scan_diffs;
ALTER TABLE scan_diffs_new RENAME TO scan_diffs;
CREATE INDEX idx_scan_diffs_domain_id ON scan_diffs (domain_id);
