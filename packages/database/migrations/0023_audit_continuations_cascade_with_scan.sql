-- Phase 11 (Database, Storage, Retention and Performance Hardening).
--
-- audit_continuations.scan_id references scans(id) with no ON DELETE clause
-- -- the same bug class as RISK-005 (migration 0022), found during this
-- phase's foreign-key audit (docs/data/PHASE_11_FOREIGN_KEY_AND_DELETION_AUDIT.md)
-- rather than named in the original risk register. This one is more urgent
-- than scan_diffs was: CONTINUATION_TTL_MINUTES is 60 (audit-continuation.ts),
-- so every continuation is already unusable (past its own expiry) long
-- before the anonymous scan it points to reaches the 7-day anonymous-scan
-- retention window (purgeAnonymousScans, data-retention.ts) -- but nothing
-- deleted the expired continuation row itself, so it lingered until that
-- purge ran, at which point the DELETE on scans would throw
-- SQLITE_CONSTRAINT_FOREIGNKEY, the same failure mode already fixed for
-- scan_diffs.
--
-- Fix: ON DELETE CASCADE, not SET NULL. Unlike scan_diffs (whose summary
-- text remains meaningful evidence even once one of the two compared scans
-- is gone), a continuation has no purpose once its scan no longer exists --
-- consumeContinuation() (apps/web/src/lib/audit-continuation.ts) looks the
-- row up by id and treats "not found" identically to "expired," so a
-- cascade-deleted continuation behaves exactly like an already-expired one
-- to every caller; there is no code path that expects scan_id to ever be
-- null on this table. scan_id stays NOT NULL.
--
-- This migration also pairs with a new data-retention.ts step (same phase)
-- that purges expired, unconsumed continuations directly -- so the row no
-- longer lingers indefinitely waiting for its scan to eventually age out;
-- the CASCADE here is a safety net for the case where a continuation for
-- some reason survives its own expiry purge, not the primary cleanup path.
--
-- Uses PRAGMA defer_foreign_keys=ON, not foreign_keys=OFF -- see migrations
-- 0013-0015/0022 and docs/data/MIGRATION_POLICY.md for why.

PRAGMA defer_foreign_keys=ON;

CREATE TABLE audit_continuations_new (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL REFERENCES scans (id) ON DELETE CASCADE,
  canonical_origin TEXT NOT NULL,
  intended_action TEXT NOT NULL CHECK (intended_action IN ('save_and_monitor', 'save_only')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);
INSERT INTO audit_continuations_new SELECT * FROM audit_continuations;
DROP TABLE audit_continuations;
ALTER TABLE audit_continuations_new RENAME TO audit_continuations;
CREATE INDEX idx_audit_continuations_expires_at ON audit_continuations (expires_at);
