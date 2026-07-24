-- Adds an explicit "active release pointer" to the registry and ruleset
-- version tables (SRS §17, FR-REG-006..008; Part 2 Step 5). A registry/
-- ruleset release becomes the one new scans evaluate against only when
-- explicitly marked active — publishing a release and activating it are
-- distinct actions (Super Admin, Part 6), matching "Roll back the active
-- release pointer" from SRS §28.11.
ALTER TABLE registry_versions ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1));
ALTER TABLE ruleset_versions ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1));

-- SQLite partial unique indexes enforce "at most one active release" at
-- the database level, not just in application code.
CREATE UNIQUE INDEX idx_registry_versions_single_active ON registry_versions (is_active) WHERE is_active = 1;
CREATE UNIQUE INDEX idx_ruleset_versions_single_active ON ruleset_versions (is_active) WHERE is_active = 1;
