-- Part 3 Step 19 performance hardening: indexes on columns that are
-- genuinely filtered/sorted on by real admin queries but were missing one
-- (found by reading the actual query code, not guessed) — see
-- docs/performance/PERFORMANCE_AND_COST.md for the full audit this came
-- from. `scans.started_at` is the highest-priority of these: it's the
-- primary date-range dimension for the admin dashboard and scan-operations
-- queries, on the single largest, fastest-growing table in the schema.

CREATE INDEX idx_scans_started_at ON scans (started_at);
CREATE INDEX idx_transactions_occurred_at ON transactions (occurred_at);
CREATE INDEX idx_webhook_events_received_at ON webhook_events (received_at);
CREATE INDEX idx_admin_audit_logs_target ON admin_audit_logs (target);
CREATE INDEX idx_security_events_resolved_at ON security_events (resolved_at);
