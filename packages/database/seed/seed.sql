-- CrawlPact local development seed data.
--
-- This file is for LOCAL DEVELOPMENT ONLY (`pnpm db:seed`, which runs against
-- the `--local` Wrangler/D1 sqlite database). It must never be applied to a
-- preview or production database.
--
-- Contents, per Part 1 Step 8:
--   1. Product plans (SRS §8 pricing table — exact values)
--   2. One non-production Super Admin fixture (no email field exists in the
--      schema; this is a display-name-only account with no real-world
--      identity, clearly labelled as a dev fixture)
--   3. Sample crawler operators and a small, source-backed registry of real,
--      publicly documented AI crawlers (accurate as of this document's
--      preparation date — re-verify against each operator's own
--      documentation before relying on this list in production; see
--      docs/registry/SOURCE_VERIFICATION_POLICY.md)
--
-- No fake production metrics, customers, scans, or findings are seeded here.
-- The audit engine is disabled by default (see .env.example
-- AUDIT_ENGINE_ENABLED) and Part 1 never fabricates scan results.

-- 1. Plans (SRS §8) ----------------------------------------------------------
INSERT INTO plans (
  id, name, annual_price_usd_cents, saved_domain_limit, monitoring_frequency,
  history_retention_days, manual_rescans_per_domain_per_month,
  domain_groups_enabled, csv_export_enabled, print_ready_report_tier,
  private_atom_feed_enabled, batch_import_limit, agency_branding_enabled
) VALUES
  ('free', 'Free', 0, 1, 'none', 30, 2, 0, 0, 'basic', 0, 0, 0),
  ('solo', 'Solo', 7900, 5, 'monthly', 365, 5, 0, 0, 'full', 1, 0, 0),
  ('pro', 'Pro', 17900, 25, 'weekly', 730, 10, 1, 1, 'full', 1, 10, 0),
  ('agency', 'Agency', 39900, 100, 'weekly', 1095, 20, 1, 1, 'full', 1, 100, 1);

-- 2. Non-production Super Admin fixture --------------------------------------
INSERT INTO admin_roles (id, name, description) VALUES
  ('super_admin', 'Super Admin', 'Full operational visibility and control (SRS §28).'),
  ('registry_manager', 'Registry Manager', 'Manage crawler registry and ruleset releases.'),
  ('billing_viewer', 'Billing Viewer', 'Read-only visibility into billing and revenue data.'),
  ('support_viewer', 'Support Viewer', 'Read-only customer support visibility.'),
  ('security_administrator', 'Security Administrator', 'Manage security events and blocked targets.'),
  ('content_manager', 'Content Manager', 'Manage public content and system notices.');

INSERT INTO users (id, display_name, status, plan_id, is_admin)
VALUES ('usr_dev_super_admin', 'Founder (Local Dev Fixture)', 'active', 'agency', 1);

INSERT INTO admin_role_assignments (id, user_id, role_id)
VALUES ('ara_dev_super_admin', 'usr_dev_super_admin', 'super_admin');

-- 3. Crawler operators and a source-backed development registry -------------
-- Sources reflect each operator's own published crawler documentation.
INSERT INTO crawler_operators (id, name, website_url) VALUES
  ('op_openai', 'OpenAI', 'https://openai.com'),
  ('op_anthropic', 'Anthropic', 'https://anthropic.com'),
  ('op_perplexity', 'Perplexity AI', 'https://perplexity.ai'),
  ('op_google', 'Google', 'https://google.com'),
  ('op_common_crawl', 'Common Crawl Foundation', 'https://commoncrawl.org'),
  ('op_apple', 'Apple', 'https://apple.com'),
  ('op_meta', 'Meta', 'https://meta.com'),
  ('op_amazon', 'Amazon', 'https://amazon.com'),
  ('op_microsoft', 'Microsoft', 'https://microsoft.com');

INSERT INTO crawlers (
  id, operator_id, name, user_agent_token, purpose, description,
  official_source_url, lifecycle_status, first_verified_at, last_verified_at,
  approved_by_user_id
) VALUES
  ('crw_gptbot', 'op_openai', 'GPTBot', 'GPTBot', 'training',
   'Used by OpenAI to crawl content that may be used to train future models.',
   'https://developers.openai.com/api/docs/bots', 'active', '2026-01-01', '2026-07-24', 'usr_dev_super_admin'),
  ('crw_oai_searchbot', 'op_openai', 'OAI-SearchBot', 'OAI-SearchBot', 'search',
   'Used to surface and link to websites in ChatGPT search results.',
   'https://developers.openai.com/api/docs/bots', 'active', '2026-01-01', '2026-07-24', 'usr_dev_super_admin'),
  ('crw_chatgpt_user', 'op_openai', 'ChatGPT-User', 'ChatGPT-User', 'user_triggered',
   'Fetches a page in direct response to a user request inside ChatGPT.',
   'https://developers.openai.com/api/docs/bots', 'active', '2026-01-01', '2026-07-24', 'usr_dev_super_admin'),
  ('crw_claudebot', 'op_anthropic', 'ClaudeBot', 'ClaudeBot', 'training',
   'Used by Anthropic to crawl content for model training.',
   'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
   'active', '2026-01-01', '2026-07-24', 'usr_dev_super_admin'),
  ('crw_claude_user', 'op_anthropic', 'Claude-User', 'Claude-User', 'user_triggered',
   'Fetches a page in direct response to a user request inside a Claude product.',
   'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
   'active', '2026-01-01', '2026-07-24', 'usr_dev_super_admin'),
  ('crw_perplexitybot', 'op_perplexity', 'PerplexityBot', 'PerplexityBot', 'search',
   'Indexes web content to serve Perplexity''s AI-powered search answers.',
   'https://docs.perplexity.ai/guides/bots', 'active', '2026-01-01', '2026-07-01', 'usr_dev_super_admin'),
  ('crw_perplexity_user', 'op_perplexity', 'Perplexity-User', 'Perplexity-User', 'user_triggered',
   'Fetches a page in direct response to a user request inside Perplexity.',
   'https://docs.perplexity.ai/guides/bots', 'active', '2026-01-01', '2026-07-01', 'usr_dev_super_admin'),
  ('crw_google_extended', 'op_google', 'Google-Extended', 'Google-Extended', 'training',
   'Controls use of website content for training Gemini and Vertex AI generative models, independent of Search indexing.',
   'https://developers.google.com/search/docs/crawling-indexing/google-extended', 'active', '2026-01-01', '2026-07-01', 'usr_dev_super_admin'),
  ('crw_googlebot', 'op_google', 'Googlebot', 'Googlebot', 'search',
   'Google''s primary web crawler for Search indexing.',
   'https://developers.google.com/search/docs/crawling-indexing/googlebot', 'active', '2026-01-01', '2026-07-01', 'usr_dev_super_admin'),
  ('crw_ccbot', 'op_common_crawl', 'CCBot', 'CCBot', 'research',
   'Builds the open Common Crawl web corpus, which is reused by many third-party model trainers.',
   'https://commoncrawl.org/ccbot', 'active', '2026-01-01', '2026-07-01', 'usr_dev_super_admin'),
  ('crw_applebot_extended', 'op_apple', 'Applebot-Extended', 'Applebot-Extended', 'training',
   'Controls use of website content for training Apple Intelligence and other Apple generative AI models.',
   'https://support.apple.com/en-us/119829', 'active', '2026-01-01', '2026-07-01', 'usr_dev_super_admin'),
  ('crw_meta_external_agent', 'op_meta', 'Meta-ExternalAgent', 'Meta-ExternalAgent', 'training',
   'Used by Meta to crawl content for training AI models and improving AI products.',
   'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/', 'active', '2026-01-01', '2026-07-01', 'usr_dev_super_admin'),
  ('crw_amazonbot', 'op_amazon', 'Amazonbot', 'Amazonbot', 'mixed',
   'Used by Amazon to improve services such as Alexa answers and other Amazon products.',
   'https://developer.amazon.com/amazonbot', 'active', '2026-01-01', '2026-07-01', 'usr_dev_super_admin'),
  ('crw_claude_searchbot', 'op_anthropic', 'Claude-SearchBot', 'Claude-SearchBot', 'search',
   'Navigates the web to improve search result quality and relevance for Claude users.',
   'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
   'active', '2026-07-22', '2026-07-22', 'usr_dev_super_admin'),
  ('crw_bingbot', 'op_microsoft', 'Bingbot', 'bingbot', 'search',
   'Microsoft''s primary web crawler for Bing Search indexing.',
   'https://www.bing.com/bingbot.htm', 'active', '2026-07-22', '2026-07-22', 'usr_dev_super_admin'),
  ('crw_meta_web_indexer', 'op_meta', 'Meta-WebIndexer', 'Meta-WebIndexer', 'search',
   'Navigates the web to improve Meta AI search result quality.',
   'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/', 'active', '2026-07-22', '2026-07-22', 'usr_dev_super_admin'),
  ('crw_meta_external_ads', 'op_meta', 'Meta-ExternalAds', 'Meta-ExternalAds', 'advertising_validation',
   'Crawls the web for use cases such as improving advertising and other business-related products.',
   'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/', 'active', '2026-07-22', '2026-07-22', 'usr_dev_super_admin'),
  ('crw_meta_external_fetcher', 'op_meta', 'Meta-ExternalFetcher', 'Meta-ExternalFetcher', 'agent',
   'Fetches individual links at a user''s request to support agentic AI capabilities in Meta products.',
   'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/', 'active', '2026-07-22', '2026-07-22', 'usr_dev_super_admin'),
  ('crw_oai_adsbot', 'op_openai', 'OAI-AdsBot', 'OAI-AdsBot', 'advertising_validation',
   'Used by OpenAI to validate the safety of web pages submitted as ads on ChatGPT; not used to train generative AI foundation models.',
   'https://developers.openai.com/api/docs/bots', 'active', '2026-07-24', '2026-07-24', 'usr_dev_super_admin'),
  ('crw_google_cloudvertexbot', 'op_google', 'Google-CloudVertexBot', 'Google-CloudVertexBot', 'agent',
   'Crawls requested by site owners for building Vertex AI Agents.',
   'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers', 'active', '2026-07-24', '2026-07-24', 'usr_dev_super_admin'),
  ('crw_googleother', 'op_google', 'GoogleOther', 'GoogleOther', 'unknown',
   'A generic crawler Google documents as usable by various internal product teams for fetching publicly accessible content; Google''s own documentation does not specify which teams or purposes.',
   'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers', 'active', '2026-07-24', '2026-07-24', 'usr_dev_super_admin');

INSERT INTO registry_versions (id, version_label, changelog, published_by_user_id, published_at, is_active)
VALUES
  ('reg_2026_07_1', '2026.07.1', 'Initial development registry: 13 crawlers across 8 operators.', 'usr_dev_super_admin', '2026-07-22T00:00:00.000Z', 0),
  ('reg_2026_07_2', '2026.07.2',
   'Added Microsoft as a new operator (Bingbot). Added Claude-SearchBot (Anthropic search crawler, distinct from ClaudeBot training and Claude-User retrieval). Added three additional Meta crawlers: Meta-WebIndexer (search), Meta-ExternalAds (advertising/validation), Meta-ExternalFetcher (agent). Registry grows from 13 to 18 crawlers across 9 operators. This is registry drift, not a change to any scanned website (FR-REG-009).',
   'usr_dev_super_admin', '2026-07-23T00:00:00.000Z', 0),
  ('reg_2026_07_3', '2026.07.3',
   'Added OAI-AdsBot (OpenAI, advertising validation — discovered while re-verifying OpenAI''s crawler docs for the public crawler directory). Added two Google crawlers not previously tracked: Google-CloudVertexBot (agent, site-owner-requested crawls for building Vertex AI Agents) and GoogleOther (a generic crawler Google documents without specifying its exact purpose, tracked as "unknown"). Registry grows from 18 to 21 crawlers across 9 operators. This is registry drift, not a change to any scanned website (FR-REG-009).',
   'usr_dev_super_admin', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 1);

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
  'crw_claude_searchbot', 'crw_bingbot', 'crw_meta_web_indexer', 'crw_meta_external_ads', 'crw_meta_external_fetcher'
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

INSERT INTO registry_version_entries (id, registry_version_id, crawler_id, snapshot)
SELECT
  'rve_2026_07_3_' || id,
  'reg_2026_07_3',
  id,
  json_object(
    'id', id, 'name', name, 'userAgentToken', user_agent_token, 'purpose', purpose,
    'lifecycleStatus', lifecycle_status, 'officialSourceUrl', official_source_url
  )
FROM crawlers;

INSERT INTO ruleset_versions (id, version_label, description, published_by_user_id, published_at, is_active)
VALUES ('rules_2026_07_2', '2026.07.2', 'Part 2 ruleset: conflict detection, findings, and Policy Health Score logic (packages/policy).', 'usr_dev_super_admin', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 1);

-- Baseline runtime configuration (SRS §28.16), validated safe defaults.
INSERT INTO runtime_configuration (key, value, value_type, description, min_value, max_value) VALUES
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
