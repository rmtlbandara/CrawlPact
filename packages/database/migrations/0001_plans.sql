-- Plans must exist before users/subscriptions can reference a plan id.
-- SRS §8: plan definitions and entitlements are data, not hard-coded UI.
CREATE TABLE plans (
  id TEXT PRIMARY KEY, -- 'free' | 'solo' | 'pro' | 'agency'
  name TEXT NOT NULL,
  annual_price_usd_cents INTEGER NOT NULL,
  saved_domain_limit INTEGER NOT NULL,
  monitoring_frequency TEXT NOT NULL CHECK (monitoring_frequency IN ('none', 'monthly', 'weekly')),
  history_retention_days INTEGER NOT NULL,
  manual_rescans_per_domain_per_month INTEGER NOT NULL,
  domain_groups_enabled INTEGER NOT NULL DEFAULT 0 CHECK (domain_groups_enabled IN (0, 1)),
  csv_export_enabled INTEGER NOT NULL DEFAULT 0 CHECK (csv_export_enabled IN (0, 1)),
  print_ready_report_tier TEXT NOT NULL DEFAULT 'basic' CHECK (print_ready_report_tier IN ('basic', 'full')),
  private_atom_feed_enabled INTEGER NOT NULL DEFAULT 0 CHECK (private_atom_feed_enabled IN (0, 1)),
  batch_import_limit INTEGER NOT NULL DEFAULT 0,
  agency_branding_enabled INTEGER NOT NULL DEFAULT 0 CHECK (agency_branding_enabled IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
