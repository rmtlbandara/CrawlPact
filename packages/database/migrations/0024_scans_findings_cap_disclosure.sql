-- Phase 11 (Database, Storage, Retention and Performance Hardening), §12.
--
-- Adds honest disclosure for the new findings cap (MAX_PERSISTED_FINDINGS,
-- packages/policy/src/findings.ts): a scan whose real finding count exceeded
-- the cap must never be silently indistinguishable from one that genuinely
-- had few findings. `findings_omitted_count` is the source of truth (0 means
-- "not capped" -- true for every historical row, since capping did not exist
-- before this migration and real production data never exceeded 10 findings
-- in a single scan, per docs/performance/PHASE_11_PRODUCTION_CAPACITY_BASELINE.md).
--
-- Simple ALTER TABLE ADD COLUMN, not a rebuild -- matches the established
-- pattern already used for scans.recommended_additions (migration 0010) and
-- scans.score_breakdown (migration 0016). No backfill needed: DEFAULT 0 is
-- the honest value for every row that predates this column.

ALTER TABLE scans ADD COLUMN findings_omitted_count INTEGER NOT NULL DEFAULT 0;
