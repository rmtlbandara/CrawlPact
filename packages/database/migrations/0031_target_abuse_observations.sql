-- Phase 12 (Security, CI, Dependency and Quality-Gate Improvements).
--
-- RISK-022: only per-caller (per-IP) rate limits existed on the anonymous
-- audit endpoint -- a distributed set of callers (many different IPs) could
-- still direct many small, individually in-bounds scans at one target with
-- nothing to detect the aggregate pattern. This adds a dedicated,
-- privacy-minimized observation table for cross-request target-frequency
-- detection only: no auto-blocking logic reads from this table anywhere,
-- and it stores no raw IP or raw target domain -- both `target_key` and
-- `caller_key` are opaque HMAC digests. `target_key` is HMAC'd with a NEW,
-- dedicated `ABUSE_MONITORING_SECRET` (never SESSION_SIGNING_SECRET, which
-- keys `caller_key` via the existing hashIp()), so this table's data can't
-- be correlated back to a specific target even if the session-signing key
-- were ever compromised, and vice versa. See
-- docs/security/TARGET_ABUSE_MONITORING_DESIGN.md.
CREATE TABLE target_abuse_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_key TEXT NOT NULL,
  caller_key TEXT NOT NULL,
  observed_at TEXT NOT NULL
);

-- Supports both the detection query (GROUP BY target_key, COUNT(DISTINCT
-- caller_key) WHERE observed_at >= cutoff) and routine pruning of rows
-- older than the detection window.
CREATE INDEX idx_target_abuse_observations_target_time
  ON target_abuse_observations(target_key, observed_at);
