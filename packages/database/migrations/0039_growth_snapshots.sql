-- Phase 1 (Growth Control Plane). The existing Google integration
-- (`apps/web/src/lib/admin/google-insights.ts`) is a real-time, read-only
-- connectivity diagnostic — it has never persisted anything. This turns it
-- into an actual measurement system: one row per (data_date, dimension)
-- collected daily, so period-over-period deltas and 7/28/90-day rollups can
-- be computed by summing/averaging accumulated daily rows instead of
-- re-querying Google's APIs for every dashboard view. `growth_collection_runs`
-- reuses `scheduled_job_runs`' own schema/convention (job_name +
-- status/error_summary) rather than a bespoke table — see worker.ts's
-- existing jobs for the same pattern.
--
-- All three tables store aggregate, privacy-safe metrics only: search
-- queries/pages, device/country breakdowns, and GA4 acquisition/engagement
-- aggregates. No customer domain names, account identifiers, IP addresses,
-- or raw audit data are ever written here (Workstream E/H boundary).

-- One row per (data_date, dimension_type, dimension_value). `dimension_type
-- = 'site'` with `dimension_value = 'site'` holds the day's total with no
-- breakdown, matching GA4's own "top-level site metrics" concept for GSC
-- (total clicks/impressions for the day, independent of any one query/page).
CREATE TABLE gsc_daily_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data_date TEXT NOT NULL,
  dimension_type TEXT NOT NULL CHECK (dimension_type IN ('site', 'query', 'page', 'device', 'country')),
  dimension_value TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0,
  position REAL NOT NULL DEFAULT 0,
  collected_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (data_date, dimension_type, dimension_value)
);

CREATE INDEX idx_gsc_daily_metrics_date_type ON gsc_daily_metrics (data_date, dimension_type);
-- Serves "top queries/pages over the last N days" rollups (SUM(clicks)
-- grouped by dimension_value, filtered by dimension_type + date range).
CREATE INDEX idx_gsc_daily_metrics_type_value ON gsc_daily_metrics (dimension_type, dimension_value, data_date);

-- One row per (data_date, dimension_type, dimension_value). GA4 "key
-- events" is an aggregate count of whatever key events are configured on
-- the property (SRS/Workstream D §8.3) — a single number here, not
-- per-event-type detail, keeping this table's shape stable regardless of
-- which key events the property owner configures later.
CREATE TABLE ga4_daily_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data_date TEXT NOT NULL,
  dimension_type TEXT NOT NULL CHECK (dimension_type IN ('site', 'channel_group', 'landing_page', 'device')),
  dimension_value TEXT NOT NULL,
  active_users INTEGER NOT NULL DEFAULT 0,
  new_users INTEGER NOT NULL DEFAULT 0,
  sessions INTEGER NOT NULL DEFAULT 0,
  engaged_sessions INTEGER NOT NULL DEFAULT 0,
  key_events INTEGER NOT NULL DEFAULT 0,
  collected_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (data_date, dimension_type, dimension_value)
);

CREATE INDEX idx_ga4_daily_metrics_date_type ON ga4_daily_metrics (data_date, dimension_type);
CREATE INDEX idx_ga4_daily_metrics_type_value ON ga4_daily_metrics (dimension_type, dimension_value, data_date);

-- CrUX field-data snapshots, written only once the origin becomes eligible
-- (Workstream D §8.4) — a legitimate `NO_DATA` period simply writes no rows
-- here, which is itself the honest signal (see growth-dashboard low-data
-- states, Workstream T).
CREATE TABLE crux_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data_date TEXT NOT NULL,
  origin TEXT NOT NULL,
  form_factor TEXT NOT NULL CHECK (form_factor IN ('PHONE', 'DESKTOP', 'TABLET', 'ALL')),
  lcp_p75_ms INTEGER,
  inp_p75_ms INTEGER,
  cls_p75 REAL,
  collected_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (data_date, origin, form_factor)
);

CREATE INDEX idx_crux_snapshots_date ON crux_snapshots (data_date);
