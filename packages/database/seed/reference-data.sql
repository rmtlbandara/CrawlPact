-- CrawlPact reference/catalog data — safe for every environment, including
-- production, unlike seed.sql (which is local-development-only: a dev admin
-- fixture and sample content).
--
-- Every INSERT here is `INSERT OR IGNORE`, keyed on each table's real
-- primary key — this file is idempotent by construction, not by extra
-- scripting logic: running it against an empty database inserts every row;
-- running it again (or against a database that already has some rows,
-- default or admin-customised) changes nothing, since a primary-key
-- conflict is silently skipped rather than overwritten. Safe to run
-- repeatedly, in any order, against local, preview, or production.
--
-- Found needed 2026-07-28: production's `plans` and `admin_roles` tables
-- were never seeded, which made every account-registration attempt fail on
-- a foreign-key violation (`users.plan_id -> plans.id`) since the database
-- was created — see docs/status/KNOWN_RISKS.md. `runtime_configuration` had
-- the same gap; lower urgency since every read of it has an in-code
-- fallback default (`lib/runtime-config.ts`), but the Super Admin runtime
-- configuration UI (SRS §28.16) has nothing to display or edit without
-- these rows — `lib/admin/runtime-config.ts`'s `updateRuntimeConfig` can
-- only update a key that already exists as a row; it never creates one.
--
-- Deliberately NOT included here (stays local-dev-only in seed.sql): the
-- "Founder (Local Dev Fixture)" super admin account, and the sample
-- crawler_operators/crawlers/registry_versions/ruleset_versions data — both
-- are dev fixtures or need a separate product decision, not unambiguous
-- reference data like the three tables below.

-- 1. Plans (SRS §8) — exact values, matching migrations/0001_plans.sql -----
INSERT OR IGNORE INTO plans (
  id, name, annual_price_usd_cents, saved_domain_limit, monitoring_frequency,
  history_retention_days, manual_rescans_per_domain_per_month,
  domain_groups_enabled, csv_export_enabled, print_ready_report_tier,
  private_atom_feed_enabled, batch_import_limit, agency_branding_enabled
) VALUES
  ('free', 'Free', 0, 1, 'none', 30, 2, 0, 0, 'basic', 0, 0, 0),
  ('solo', 'Solo', 7900, 5, 'monthly', 365, 5, 0, 0, 'full', 1, 0, 0),
  ('pro', 'Pro', 17900, 25, 'weekly', 730, 10, 1, 1, 'full', 1, 10, 0),
  ('agency', 'Agency', 39900, 100, 'weekly', 1095, 20, 1, 1, 'full', 1, 100, 1);

-- 2. Admin roles (SRS §28.18 RBAC catalog) — exact values, matching
--    migrations/0007_admin_security.sql's role model ------------------------
INSERT OR IGNORE INTO admin_roles (id, name, description) VALUES
  ('super_admin', 'Super Admin', 'Full operational visibility and control (SRS §28).'),
  ('registry_manager', 'Registry Manager', 'Manage crawler registry and ruleset releases.'),
  ('billing_viewer', 'Billing Viewer', 'Read-only visibility into billing and revenue data.'),
  ('support_viewer', 'Support Viewer', 'Read-only customer support visibility.'),
  ('security_administrator', 'Security Administrator', 'Manage security events and blocked targets.'),
  ('content_manager', 'Content Manager', 'Manage public content and system notices.');

-- 3. Runtime configuration baseline (SRS §28.16) — exact values, matching
--    the safe defaults every reader of lib/runtime-config.ts already
--    assumes as its in-code fallback ----------------------------------------
INSERT OR IGNORE INTO runtime_configuration (key, value, value_type, description, min_value, max_value) VALUES
  ('anonymous_audit_daily_limit', '20', 'integer', 'Max anonymous audits per IP per day.', 1, 1000),
  ('manual_scan_timeout_seconds', '20', 'integer', 'Per-resource fetch timeout during a scan.', 1, 60),
  ('scan_total_timeout_seconds', '30', 'integer', 'Total wall-clock budget for one scan across all resources (FR-FET-007).', 5, 120),
  ('max_body_size_bytes', '2097152', 'integer', 'Maximum response body size accepted from a scanned resource.', 1024, 10485760),
  ('scan_redirect_limit', '5', 'integer', 'Maximum redirects followed per resource (FR-FET-005).', 0, 10),
  ('scan_external_request_limit', '12', 'integer', 'Maximum external requests per scan (FR-FET-008).', 1, 50),
  ('maintenance_mode', 'false', 'boolean', 'Global maintenance mode switch (SRS §28.17).', NULL, NULL),
  ('scheduler_paused', 'false', 'boolean', 'Pauses the scheduled monitoring sweep globally during an incident (SRS §28.10). Paddle webhooks and the public site remain unaffected.', NULL, NULL),
  ('monitoring_scan_batch_size', '20', 'integer', 'Maximum domains claimed per scheduled monitoring sweep.', 1, 200),
  ('monitoring_claim_lock_minutes', '15', 'integer', 'How long a claimed domain is locked against a second concurrent sweep.', 1, 120),
  ('monitoring_failure_pause_threshold', '5', 'integer', 'Consecutive scan failures before monitoring auto-pauses for a domain.', 1, 20),
  ('anonymous_scan_retention_days', '7', 'integer', 'Days an anonymous (unowned) scan is kept before the daily retention job purges it.', 1, 90),
  ('account_deletion_grace_period_days', '30', 'integer', 'Cancellable grace period before a pending-deletion account is hard-deleted.', 1, 180);
