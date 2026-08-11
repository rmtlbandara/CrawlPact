-- Phase 15: registry release integrity hardening.
--
-- `checksum`: a deterministic SHA-256 over the canonical (sorted-key,
-- crawler-id-ordered) entry snapshots of a release, computed at publish
-- time and stored so it can be independently re-verified later without
-- trusting whatever the live application code currently believes the
-- algorithm is (`registry:checksum:verify` recomputes and compares).
--
-- `snapshot_schema_version`: existing (pre-Phase-15) `registry_version_entries`
-- rows were written before the canonical snapshot shape existed (no
-- `operatorName` field, no explicit field-order canonicalisation). Rather
-- than rewrite historical snapshots (which would be exactly the kind of
-- silent historical-evidence mutation this phase exists to prevent), old
-- rows are explicitly tagged schema version 1 and new rows are written as
-- schema version 2; readers handle both.
--
-- `registry_version_activations`: a durable, append-only history of every
-- activation-pointer change (publish, rollback, reactivation), kept
-- separate from `registry_versions.published_at` so CrawlPact can explain
-- "published on X, activated on Y, rolled back on Z, reactivated on W"
-- without ever mutating a release's own publication record.

ALTER TABLE registry_versions ADD COLUMN checksum TEXT;

ALTER TABLE registry_version_entries ADD COLUMN snapshot_schema_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE registry_version_activations (
  id TEXT PRIMARY KEY,
  registry_version_id TEXT NOT NULL REFERENCES registry_versions (id),
  action TEXT NOT NULL CHECK (action IN ('published', 'rolled_back_to', 'reactivated')),
  previous_active_version_id TEXT REFERENCES registry_versions (id),
  performed_by_user_id TEXT REFERENCES users (id),
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_registry_version_activations_version_id
  ON registry_version_activations (registry_version_id);
CREATE INDEX idx_registry_version_activations_created_at
  ON registry_version_activations (created_at DESC);
