-- Phase 8 (Saved-Domain Experience and Change Timeline).
--
-- Materialised, immutable change-timeline events, one row per meaningful
-- domain event (a scan-to-scan comparison with a real change, or a preset
-- change) rather than a page-render-time derivation over scans/scan_diffs/
-- findings/registry_versions. See docs/product/DOMAIN_CHANGE_TIMELINE_ARCHITECTURE.md
-- for why "derive on read" was rejected (RISK-008 CPU-budget cost, and the
-- risk of a future attribution-model revision silently reinterpreting old
-- history) and docs/product/DOMAIN_TIMELINE_EVENT_MODEL.md for the full
-- column-by-column rationale.
--
-- Deliberately a new table rather than extending scan_diffs: scan_diffs
-- already feeds the existing notification pipeline (apps/web/src/lib/
-- monitoring.ts) with its own narrower 3-value diff_type; extending it in
-- place would risk changing notification behaviour as a side effect of a UI
-- feature. This table is generated alongside, not instead of, scan_diffs.
--
-- Foreign-key behaviour follows the Phase 11 pattern used for scan_diffs
-- (migration 0022): the event record survives its referenced scans/registry
-- versions ageing out under retention or (registry versions are never
-- actually deleted today, only unpublished) any future deletion path; only
-- domain_id cascades, matching every other per-domain table in this schema.
CREATE TABLE domain_change_events (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL REFERENCES domains (id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'baseline',
      'website_policy_change',
      'registry_driven_change',
      'mixed_change',
      'operational_change'
    )
  ),
  change_origin TEXT NOT NULL CHECK (
    change_origin IN ('website_policy', 'registry_driven', 'mixed', 'operational', 'uncertain', 'baseline')
  ),
  attention_level TEXT NOT NULL CHECK (
    attention_level IN ('informational', 'review_recommended', 'high_attention')
  ),
  observed_at TEXT NOT NULL,
  previous_scan_id TEXT REFERENCES scans (id) ON DELETE SET NULL,
  current_scan_id TEXT REFERENCES scans (id) ON DELETE SET NULL,
  previous_registry_version_id TEXT REFERENCES registry_versions (id) ON DELETE SET NULL,
  current_registry_version_id TEXT REFERENCES registry_versions (id) ON DELETE SET NULL,
  affected_purposes_json TEXT NOT NULL,
  finding_counts_json TEXT NOT NULL,
  summary TEXT NOT NULL,
  details_json TEXT NOT NULL,
  completeness TEXT NOT NULL CHECK (completeness IN ('complete', 'partial')),
  fingerprint TEXT NOT NULL,
  model_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Timeline pagination: WHERE domain_id = ? ORDER BY observed_at DESC.
CREATE INDEX idx_domain_change_events_domain_observed ON domain_change_events (domain_id, observed_at DESC);

-- Idempotency: a retried sweep or a raced manual/scheduled scan pair must
-- never produce two rows for the same logical event (see the event model
-- doc's fingerprint definition) — enforced with a real unique index, not
-- just application-level care, so onConflictDoNothing() is a correctness
-- guarantee rather than a best-effort convention.
CREATE UNIQUE INDEX idx_domain_change_events_fingerprint ON domain_change_events (fingerprint);
