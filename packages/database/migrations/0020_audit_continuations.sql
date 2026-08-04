-- Phase 5 (Anonymous Audit Result and Account-Conversion Flow): a short-lived, server-side
-- record that lets a "Save and monitor this domain" click on an anonymous report survive the
-- signup/login round trip without placing report content, findings, or a bearer secret in a URL
-- or client-stored token. See docs/security/PHASE_05_AUDIT_CONVERSION_THREAT_REVIEW.md.
--
-- `id` is the opaque continuation identifier itself (crypto.randomUUID(), matching the same
-- non-sequential-random convention already used for `scans.id`/`domains.id` — not a bearer
-- secret with money-like value, so it is stored raw rather than hashed like a recovery code:
-- worst case if leaked is that a *public* domain audit gets saved to an account other than the
-- one that requested it, which the product already allows (the same public domain can
-- legitimately be saved by multiple accounts).
--
-- `scan_id` is intentionally NOT a hard NOT NULL FK-enforced-at-runtime reference in the sense
-- other tables in this file rely on (this project does not enforce SQLite FK constraints at
-- delete time — see `purgeAnonymousScans` in apps/web/src/lib/data-retention.ts, which deletes
-- `scans` rows directly with no dependent-row cleanup). A continuation's TTL (60 minutes,
-- app-level) is far shorter than the anonymous-scan retention window (24h-7d), so in practice a
-- continuation always expires long before its referenced scan could ever be purged; the handoff
-- route still defensively handles a missing scan as "audit no longer available" regardless.
CREATE TABLE audit_continuations (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL REFERENCES scans (id),
  canonical_origin TEXT NOT NULL,
  intended_action TEXT NOT NULL CHECK (intended_action IN ('save_and_monitor', 'save_only')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE INDEX idx_audit_continuations_expires_at ON audit_continuations (expires_at);
