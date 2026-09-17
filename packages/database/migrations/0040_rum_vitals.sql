-- Phase 1 (Growth Control Plane), Workstream 3: first-party Real User
-- Monitoring for Core Web Vitals. CrUX currently reports NO_DATA (origin
-- below Chrome UX Report's field-data eligibility threshold) — this table
-- is the interim, owned field-performance source until CrUX becomes
-- eligible (§17: CrUX simply starts contributing later, RUM never blocks on
-- it). Deliberately its own table, not `product_events` or
-- `security_events` — this is high-frequency, anonymous, non-authoritative
-- telemetry, not product/commercial truth (lib/growth) and not a security
-- signal (lib/auth/rate-limit.ts's `security_events`).
--
-- Privacy: no user id, no session id, no IP address (only a salted hash is
-- ever used transiently for rate limiting, never stored here), no query
-- string, no full URL. `route` is a bounded, low-cardinality bucket label
-- (see lib/rum.ts's `normalizeRumRoute`), never the raw pathname.
CREATE TABLE rum_vitals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL CHECK (metric_name IN ('LCP', 'INP', 'CLS', 'FCP', 'TTFB')),
  metric_value REAL NOT NULL,
  rating TEXT CHECK (rating IN ('good', 'needs-improvement', 'poor')),
  route TEXT NOT NULL,
  surface TEXT NOT NULL CHECK (surface IN ('public', 'app')),
  device_category TEXT NOT NULL CHECK (device_category IN ('mobile', 'desktop')),
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Serves the growth dashboard's "RUM p75 by metric, last N days" query
-- (filter by metric_name + recorded_at, optionally split by device).
CREATE INDEX idx_rum_vitals_metric_recorded ON rum_vitals (metric_name, recorded_at);
CREATE INDEX idx_rum_vitals_recorded_at ON rum_vitals (recorded_at);
