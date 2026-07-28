-- CrawlPact local development seed data.
--
-- This file is for LOCAL DEVELOPMENT ONLY (`pnpm db:seed`, which runs against
-- the `--local` Wrangler/D1 sqlite database). It must never be applied to a
-- preview or production database. `db:seed` runs `reference-data.sql` (the
-- real, environment-safe plan/role/config/crawler-registry catalogs — see
-- that file) first, then this file for the dev-only extras below.
--
-- Contents, per Part 1 Step 8:
--   1. One non-production Super Admin fixture (no email field exists in the
--      schema; this is a display-name-only account with no real-world
--      identity, clearly labelled as a dev fixture) — assigned the
--      `super_admin` role `reference-data.sql` already created.
--   2. Two illustrative, inactive historical registry-version snapshots
--      (`reference-data.sql` already seeds the crawlers themselves and the
--      one active, current registry/ruleset release — these two are purely
--      for exercising the admin registry-version-history UI in local dev).
--
-- No fake production metrics, customers, scans, or findings are seeded here.
-- The audit engine is disabled by default (see .env.example
-- AUDIT_ENGINE_ENABLED) and Part 1 never fabricates scan results.

-- 1. Non-production Super Admin fixture --------------------------------------

INSERT INTO users (id, display_name, status, plan_id, is_admin)
VALUES ('usr_dev_super_admin', 'Founder (Local Dev Fixture)', 'active', 'agency', 1);

INSERT INTO admin_role_assignments (id, user_id, role_id)
VALUES ('ara_dev_super_admin', 'usr_dev_super_admin', 'super_admin');

-- 2. Illustrative, inactive historical registry versions (dev-only UI
--    exercise — reference-data.sql already seeded the real crawlers and the
--    one active 2026.07.3 release) -------------------------------------------
INSERT INTO registry_versions (id, version_label, changelog, published_by_user_id, published_at, is_active)
VALUES
  ('reg_2026_07_1', '2026.07.1', 'Initial development registry: 13 crawlers across 8 operators.', 'usr_dev_super_admin', '2026-07-22T00:00:00.000Z', 0),
  ('reg_2026_07_2', '2026.07.2',
   'Added Microsoft as a new operator (Bingbot). Added Claude-SearchBot (Anthropic search crawler, distinct from ClaudeBot training and Claude-User retrieval). Added three additional Meta crawlers: Meta-WebIndexer (search), Meta-ExternalAds (advertising/validation), Meta-ExternalFetcher (agent). Registry grows from 13 to 18 crawlers across 9 operators. This is registry drift, not a change to any scanned website (FR-REG-009).',
   'usr_dev_super_admin', '2026-07-23T00:00:00.000Z', 0);

-- Each release snapshots the full registry state at that point in time
-- (releases are immutable and complete, not diffs) — but 2026.07.1 only
-- ever included the first 13 crawlers, and 2026.07.2 only the first 18,
-- matching their own changelogs above.
INSERT INTO registry_version_entries (id, registry_version_id, crawler_id, snapshot)
SELECT
  'rve_2026_07_1_' || id,
  'reg_2026_07_1',
  id,
  json_object(
    'id', id, 'name', name, 'userAgentToken', user_agent_token, 'purpose', purpose,
    'lifecycleStatus', lifecycle_status, 'officialSourceUrl', official_source_url
  )
FROM crawlers
WHERE id NOT IN (
  'crw_claude_searchbot', 'crw_bingbot', 'crw_meta_web_indexer', 'crw_meta_external_ads', 'crw_meta_external_fetcher',
  'crw_oai_adsbot', 'crw_google_cloudvertexbot', 'crw_googleother'
);

INSERT INTO registry_version_entries (id, registry_version_id, crawler_id, snapshot)
SELECT
  'rve_2026_07_2_' || id,
  'reg_2026_07_2',
  id,
  json_object(
    'id', id, 'name', name, 'userAgentToken', user_agent_token, 'purpose', purpose,
    'lifecycleStatus', lifecycle_status, 'officialSourceUrl', official_source_url
  )
FROM crawlers
WHERE id NOT IN ('crw_oai_adsbot', 'crw_google_cloudvertexbot', 'crw_googleother');

-- Runtime configuration baseline (SRS §28.16), the crawler registry/ruleset
-- catalogs, plans, and admin roles now all live in reference-data.sql (real,
-- environment-safe defaults — not dev-only), applied before this file.
