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
-- "Founder (Local Dev Fixture)" super admin account only — every actor
-- reference below uses NULL instead.
--
-- The crawler registry (crawler_operators/crawlers/registry_versions/
-- ruleset_versions) IS included, added 2026-07-28: this is the same real,
-- source-verified-against-each-operator's-own-documentation registry the
-- product's public SEO content (crawler-reference pages, docs/registry/
-- SOURCE_VERIFICATION_POLICY.md) is already built around — not dev/test
-- data. Its absence in production is a hard blocker, not a cosmetic gap:
-- `lib/registry-data.ts`'s `getActiveRegistry()` requires an active
-- `registry_versions` row and an active `ruleset_versions` row before any
-- scan can run at all — found 2026-07-28 when enabling
-- `AUDIT_ENGINE_ENABLED` in production surfaced `SERVICE_UNAVAILABLE: No
-- active crawler registry release is configured` as the very next blocker.

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

-- 4. Crawler registry operators — real, source-documented AI/search crawler
--    operators (matches the public crawler-reference content) -------------
INSERT OR IGNORE INTO crawler_operators (id, name, website_url) VALUES
  ('op_openai', 'OpenAI', 'https://openai.com'),
  ('op_anthropic', 'Anthropic', 'https://anthropic.com'),
  ('op_perplexity', 'Perplexity AI', 'https://perplexity.ai'),
  ('op_google', 'Google', 'https://google.com'),
  ('op_common_crawl', 'Common Crawl Foundation', 'https://commoncrawl.org'),
  ('op_apple', 'Apple', 'https://apple.com'),
  ('op_meta', 'Meta', 'https://meta.com'),
  ('op_amazon', 'Amazon', 'https://amazon.com'),
  ('op_microsoft', 'Microsoft', 'https://microsoft.com');

-- 5. Crawler registry — 21 real, source-verified crawlers (see each row's
--    official_source_url). `approved_by_user_id` is NULL here (not the
--    local-dev fixture user) since this file must be safe to run in
--    production, where that user never exists -----------------------------
INSERT OR IGNORE INTO crawlers (
  id, operator_id, name, user_agent_token, purpose, description,
  official_source_url, lifecycle_status, first_verified_at, last_verified_at,
  approved_by_user_id
) VALUES
  ('crw_gptbot', 'op_openai', 'GPTBot', 'GPTBot', 'training',
   'Used by OpenAI to crawl content that may be used to train future models.',
   'https://developers.openai.com/api/docs/bots', 'active', '2026-01-01', '2026-07-24', NULL),
  ('crw_oai_searchbot', 'op_openai', 'OAI-SearchBot', 'OAI-SearchBot', 'search',
   'Used to surface and link to websites in ChatGPT search results.',
   'https://developers.openai.com/api/docs/bots', 'active', '2026-01-01', '2026-07-24', NULL),
  ('crw_chatgpt_user', 'op_openai', 'ChatGPT-User', 'ChatGPT-User', 'user_triggered',
   'Fetches a page in direct response to a user request inside ChatGPT.',
   'https://developers.openai.com/api/docs/bots', 'active', '2026-01-01', '2026-07-24', NULL),
  ('crw_claudebot', 'op_anthropic', 'ClaudeBot', 'ClaudeBot', 'training',
   'Used by Anthropic to crawl content for model training.',
   'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
   'active', '2026-01-01', '2026-07-24', NULL),
  ('crw_claude_user', 'op_anthropic', 'Claude-User', 'Claude-User', 'user_triggered',
   'Fetches a page in direct response to a user request inside a Claude product.',
   'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
   'active', '2026-01-01', '2026-07-24', NULL),
  ('crw_perplexitybot', 'op_perplexity', 'PerplexityBot', 'PerplexityBot', 'search',
   'Indexes web content to serve Perplexity''s AI-powered search answers.',
   'https://docs.perplexity.ai/guides/bots', 'active', '2026-01-01', '2026-07-01', NULL),
  ('crw_perplexity_user', 'op_perplexity', 'Perplexity-User', 'Perplexity-User', 'user_triggered',
   'Fetches a page in direct response to a user request inside Perplexity.',
   'https://docs.perplexity.ai/guides/bots', 'active', '2026-01-01', '2026-07-01', NULL),
  ('crw_google_extended', 'op_google', 'Google-Extended', 'Google-Extended', 'training',
   'Controls use of website content for training Gemini and Vertex AI generative models, independent of Search indexing.',
   'https://developers.google.com/search/docs/crawling-indexing/google-extended', 'active', '2026-01-01', '2026-07-01', NULL),
  ('crw_googlebot', 'op_google', 'Googlebot', 'Googlebot', 'search',
   'Google''s primary web crawler for Search indexing.',
   'https://developers.google.com/search/docs/crawling-indexing/googlebot', 'active', '2026-01-01', '2026-07-01', NULL),
  ('crw_ccbot', 'op_common_crawl', 'CCBot', 'CCBot', 'research',
   'Builds the open Common Crawl web corpus, which is reused by many third-party model trainers.',
   'https://commoncrawl.org/ccbot', 'active', '2026-01-01', '2026-07-01', NULL),
  ('crw_applebot_extended', 'op_apple', 'Applebot-Extended', 'Applebot-Extended', 'training',
   'Controls use of website content for training Apple Intelligence and other Apple generative AI models.',
   'https://support.apple.com/en-us/119829', 'active', '2026-01-01', '2026-07-01', NULL),
  ('crw_meta_external_agent', 'op_meta', 'Meta-ExternalAgent', 'Meta-ExternalAgent', 'training',
   'Used by Meta to crawl content for training AI models and improving AI products.',
   'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/', 'active', '2026-01-01', '2026-07-01', NULL),
  ('crw_amazonbot', 'op_amazon', 'Amazonbot', 'Amazonbot', 'mixed',
   'Used by Amazon to improve services such as Alexa answers and other Amazon products.',
   'https://developer.amazon.com/amazonbot', 'active', '2026-01-01', '2026-07-01', NULL),
  ('crw_claude_searchbot', 'op_anthropic', 'Claude-SearchBot', 'Claude-SearchBot', 'search',
   'Navigates the web to improve search result quality and relevance for Claude users.',
   'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
   'active', '2026-07-22', '2026-07-22', NULL),
  ('crw_bingbot', 'op_microsoft', 'Bingbot', 'bingbot', 'search',
   'Microsoft''s primary web crawler for Bing Search indexing.',
   'https://www.bing.com/bingbot.htm', 'active', '2026-07-22', '2026-07-22', NULL),
  ('crw_meta_web_indexer', 'op_meta', 'Meta-WebIndexer', 'Meta-WebIndexer', 'search',
   'Navigates the web to improve Meta AI search result quality.',
   'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/', 'active', '2026-07-22', '2026-07-22', NULL),
  ('crw_meta_external_ads', 'op_meta', 'Meta-ExternalAds', 'Meta-ExternalAds', 'advertising_validation',
   'Crawls the web for use cases such as improving advertising and other business-related products.',
   'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/', 'active', '2026-07-22', '2026-07-22', NULL),
  ('crw_meta_external_fetcher', 'op_meta', 'Meta-ExternalFetcher', 'Meta-ExternalFetcher', 'agent',
   'Fetches individual links at a user''s request to support agentic AI capabilities in Meta products.',
   'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/', 'active', '2026-07-22', '2026-07-22', NULL),
  ('crw_oai_adsbot', 'op_openai', 'OAI-AdsBot', 'OAI-AdsBot', 'advertising_validation',
   'Used by OpenAI to validate the safety of web pages submitted as ads on ChatGPT; not used to train generative AI foundation models.',
   'https://developers.openai.com/api/docs/bots', 'active', '2026-07-24', '2026-07-24', NULL),
  ('crw_google_cloudvertexbot', 'op_google', 'Google-CloudVertexBot', 'Google-CloudVertexBot', 'agent',
   'Crawls requested by site owners for building Vertex AI Agents.',
   'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers', 'active', '2026-07-24', '2026-07-24', NULL),
  ('crw_googleother', 'op_google', 'GoogleOther', 'GoogleOther', 'unknown',
   'A generic crawler Google documents as usable by various internal product teams for fetching publicly accessible content; Google''s own documentation does not specify which teams or purposes.',
   'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers', 'active', '2026-07-24', '2026-07-24', NULL);

-- 6. One active registry release and one active ruleset release — required
--    by `lib/registry-data.ts`'s `getActiveRegistry()` before any scan can
--    run at all (found 2026-07-28: `SERVICE_UNAVAILABLE: No active crawler
--    registry release is configured` was the very next blocker after
--    enabling AUDIT_ENGINE_ENABLED in production) --------------------------
INSERT OR IGNORE INTO registry_versions (id, version_label, changelog, published_by_user_id, published_at, is_active)
VALUES (
  'reg_2026_07_3', '2026.07.3',
  'Full registry: 21 crawlers across 9 operators, each source-verified against the operator''s own published documentation (see docs/registry/SOURCE_VERIFICATION_POLICY.md).',
  NULL, '2026-07-28T00:00:00.000Z', 1
);

INSERT OR IGNORE INTO ruleset_versions (id, version_label, description, published_by_user_id, published_at, is_active)
VALUES (
  'rules_2026_07_2', '2026.07.2',
  'Conflict detection, findings, and Policy Health Score logic (packages/policy).',
  NULL, '2026-07-28T00:00:00.000Z', 1
);

INSERT OR IGNORE INTO registry_version_entries (id, registry_version_id, crawler_id, snapshot)
SELECT
  'rve_2026_07_3_' || id,
  'reg_2026_07_3',
  id,
  json_object(
    'id', id, 'name', name, 'userAgentToken', user_agent_token, 'purpose', purpose,
    'lifecycleStatus', lifecycle_status, 'officialSourceUrl', official_source_url
  )
FROM crawlers
WHERE operator_id IN (
  'op_openai', 'op_anthropic', 'op_perplexity', 'op_google', 'op_common_crawl',
  'op_apple', 'op_meta', 'op_amazon', 'op_microsoft'
);
