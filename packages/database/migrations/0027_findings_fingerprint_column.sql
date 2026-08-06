-- Phase 8 (Saved-Domain Experience and Change Timeline).
--
-- The finding fingerprint (packages/policy/src/findings.ts) already exists
-- and is already computed at persist time, but today lives only inside the
-- `evidence` JSON blob (apps/web/src/lib/persist-scan.ts) -- not a
-- first-class, queryable column. The Phase 8 finding-lifecycle feature
-- (docs/product/FINDING_LIFECYCLE_MODEL.md) needs to classify a finding as
-- appeared/persisting/changed/resolved across two scans, which means
-- comparing fingerprints across rows -- not practical to do efficiently by
-- JSON-parsing `evidence` on every row on every comparison.
--
-- Backfilled from the same JSON blob every existing row already carries
-- (json_extract, supported by D1's SQLite JSON1 extension), so old and new
-- findings share one identity scheme with no dual-format handling needed at
-- query time. No new index is added: every real query filters by
-- `scan_id IN (?, ?)` first (already covered by idx_findings_scan_id,
-- migration 0005), then compares the small in-memory fingerprint set
-- (MAX_PERSISTED_FINDINGS = 25 rows per scan) -- a dedicated index on
-- fingerprint alone would not be used by that access pattern.
ALTER TABLE findings ADD COLUMN fingerprint TEXT;

UPDATE findings SET fingerprint = json_extract(evidence, '$.fingerprint') WHERE fingerprint IS NULL;
