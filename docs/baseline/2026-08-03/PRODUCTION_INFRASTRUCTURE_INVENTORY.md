# Production Infrastructure Inventory — 2026-08-03

Phase 0 baseline. All facts below are direct observations from read-only Cloudflare MCP calls,
read-only Paddle MCP calls, and public HTTP requests against `https://crawlpact.com`, made during
this audit on 2026-08-03. No infrastructure, billing, or database configuration was changed.
Timestamps: audit performed starting 2026-08-03T10:09Z UTC / 2026-08-03T15:39 Asia/Colombo.

## 1. Cloudflare Workers

| Worker                                                     | Purpose                                                                                                       | Created              | Last modified        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------- |
| `crawlpact-web`                                            | Production CrawlPact app                                                                                      | 2026-07-26T10:18:34Z | 2026-07-31T11:44:43Z |
| `crawlpact-web-preview`                                    | Preview environment                                                                                           | 2026-07-26T12:14:57Z | 2026-07-31T11:41:47Z |
| `crawlpact-e2e-fixture`                                    | E2E test fixture app (`apps/e2e-fixture`), not customer-facing                                                | 2026-07-30T04:25:21Z | 2026-07-30T04:25:26Z |
| `lowerbillhome`, `nimblegrid`, `ezroamguide`, `echobuddha` | **Unrelated to CrawlPact** — pre-existing workers on the same Cloudflare account, out of scope for this audit | —                    | —                    |

Status: **verified-live** (source: `workers_list` MCP call, 2026-08-03).

## 2. D1 Databases

| Database                    | UUID                                   | Created              | File size (bytes) |
| --------------------------- | -------------------------------------- | -------------------- | ----------------- |
| `crawlpact-db` (production) | `dd295b75-7376-4f05-8c50-fb0a63cc3cee` | 2026-07-26T12:10:48Z | 3,399,680         |
| `crawlpact-db-preview`      | `e9c9f730-1f0d-4f4e-8775-db94126b12f0` | 2026-07-26T12:11:02Z | 651,264           |

Both UUIDs match `apps/web/wrangler.jsonc`'s `d1_databases` blocks exactly (top-level and
`env.preview`). Status: **verified-live**.

### 2.1 Applied migrations (production `crawlpact-db`, live query against `d1_migrations`)

`0001_plans.sql` → `0018_incidents.sql` (18 migrations), identical list and order to
`packages/database/migrations/` on disk at HEAD `0d23f5a4b589ade5e14e7070aadb8607357c7d46`
(verified by direct `ls` comparison — see DATABASE_AND_MIGRATION_BASELINE.md). **No drift between
local and production migration state.** Preview database has the identical 18-migration list.

This is more recent than `docs/status/IMPLEMENTATION_STATUS.md`'s 2026-07-26 note of "16/16
migrations, 38 tables" — production has since had two more migrations applied (`0017`, `0018`)
that post-date that document. Logged as DC (documentation conflict) — see
`DOCUMENTATION_CONFLICTS.md`.

### 2.2 Tables (production, live query against `sqlite_master`)

39 real tables (excludes `d1_migrations`, `sqlite_*`): `admin_audit_logs`,
`admin_role_assignments`, `admin_roles`, `billing_customers`, `blocked_targets`,
`crawler_operators`, `crawlers`, `domain_groups`, `domains`, `feed_tokens`, `findings`,
`incident_updates`, `incidents`, `internal_user_notes`, `notifications`, `passkey_credentials`,
`plans`, `product_events`, `recovery_codes`, `registry_version_entries`, `registry_versions`,
`ruleset_versions`, `runtime_configuration`, `saved_filters`, `scan_crawler_results`,
`scan_diffs`, `scan_resources`, `scans`, `scheduled_job_runs`, `security_events`, `sessions`,
`shared_reports`, `subscriptions`, `system_notices`, `table_preferences`,
`temporary_entitlements`, `transactions`, `user_preferences`, `users`, `webhook_events`.

Note: the local `pnpm db:validate` run this session (see TEST_AND_CI_EVIDENCE.md) reports "40
tables verified consistent between migrations and Drizzle schema" — one more than the 39 counted
live against production's `sqlite_master`. Not investigated further (Phase 0 does not fix
discoveries); logged as a documentation/tooling discrepancy in `DOCUMENTATION_CONFLICTS.md`.

### 2.3 Production data volumes (aggregate counts only — no row contents, no PII)

| Table               | Count |
| ------------------- | ----- |
| `users`             | 2     |
| `domains`           | 9     |
| `scans`             | 27    |
| `subscriptions`     | 1     |
| `crawlers`          | 21    |
| `crawler_operators` | 9     |
| `plans`             | 4     |
| `admin_roles`       | 6     |
| `incidents`         | 0     |
| `webhook_events`    | 46    |

Status: **verified-live** (source: direct read-only `SELECT COUNT(*)` queries, 2026-08-03; per
Phase 0 rules, no row-level customer data was read or recorded).

## 3. KV Namespaces

| Namespace                       | ID                                 |
| ------------------------------- | ---------------------------------- |
| `crawlpact-web-session`         | `e092c1f4171243cf801b5af24070dfca` |
| `crawlpact-web-preview-session` | `6c940efc0991477a88fa9f730c53b476` |

Matches `wrangler.jsonc`'s `kv_namespaces` blocks exactly. Purpose (per code comment in
`wrangler.jsonc`): satisfies `@astrojs/cloudflare`'s mandatory session-KV binding requirement; the
app's real session store is D1-backed (ADR-0004), this KV binding is otherwise unused. Status:
**verified-live**.

## 4. R2 Buckets

| Bucket                                          | Created              |
| ----------------------------------------------- | -------------------- |
| `crawlpact` (production `AGENCY_LOGOS` binding) | 2026-07-30T04:53:19Z |
| `crawlpact-preview`                             | 2026-07-30T05:08:17Z |

Purpose: agency-branding logo uploads only (per `wrangler.jsonc` comment and
`docs/data/D1_R2_DATA_PLACEMENT_POLICY.md`'s 2026-07-30 entry, cited not re-verified in full this
pass). Status: **verified-live**.

## 5. Cron triggers

`"crons": ["0 3 * * *"]` — daily at 03:00 UTC, drives both the monitoring sweep
(`lib/monitoring.ts`) and the data-retention purge (`lib/data-retention.ts`) via `worker.ts`'s
`scheduled()` export (per `wrangler.jsonc` comment). Status: **code-present-not-production-verified**
— cron _configuration_ is confirmed live (present in the deployed `wrangler.jsonc`), but this audit
did not verify an actual recent execution log (Cloudflare's cron trigger execution history was not
queried this pass — not verified, required access/tooling for that specific query was not
exercised). Recommended for Phase 14 (Status, Operations and Service Reliability).

## 6. Paddle live catalog (read-only, `client.products.list`/`client.notificationSettings.list`)

| Product          | Product ID                       | Price ID                         | Billing cycle | Amount            | Currency | Status |
| ---------------- | -------------------------------- | -------------------------------- | ------------- | ----------------- | -------- | ------ |
| CrawlPact Solo   | `pro_01kyfjzj2pte9mcgyg4f3smpem` | `pri_01kyfjzj3t4x2t4dqrmnkjj0r2` | 1× year       | 7,900 (=$79.00)   | USD      | active |
| CrawlPact Pro    | `pro_01kyfjzj6xdb6he6mygawd165n` | `pri_01kyfjzj81k6w2ds6r6a2jcv93` | 1× year       | 17,900 (=$179.00) | USD      | active |
| CrawlPact Agency | `pro_01kyfjzjb29p9y2ebtbxzx6nkv` | `pri_01kyfjzjc4tbhve9czw1dq2b1b` | 1× year       | 39,900 (=$399.00) | USD      | active |

All three price IDs match `apps/web/wrangler.jsonc`'s production `vars` exactly
(`PADDLE_PRICE_ID_SOLO`/`PRO`/`AGENCY`). **Annual billing only — no monthly price exists in the
live catalog for any plan**, consistent with the codebase having no monthly-price field at all
(see BILLING_AND_PLAN_BASELINE.md). Amounts match `packages/database/seed/reference-data.sql`'s
`annual_price_usd_cents` values exactly (7900/17900/39900). Status: **verified-live**.

### 6.1 Webhook notification destination

| Field             | Value                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| ID                | `ntfset_01kyfkc59d8h66prnhw220hnzy`                                                                                                          |
| Description       | "CrawlPact production billing webhook"                                                                                                       |
| Destination       | `https://crawlpact.com/api/billing/webhook`                                                                                                  |
| Active            | `true`                                                                                                                                       |
| Traffic source    | `platform` (real traffic only — not `all`/`simulation`, confirming the 2026-07-28 test's `traffic_source` reversion back to `platform` held) |
| Subscribed events | Full `transaction.*` (9 types), `subscription.*` (8 types), `customer.*` (3 types), `adjustment.*` (2 types) families — 24 event types total |

Matches `docs/status/PADDLE_WEBHOOK_LIVE_DELIVERY_VERIFICATION.md`'s description of subscribed
event coverage. The webhook secret itself (`endpoint_secret_key`) was **not requested or recorded**
in this audit, per Phase 0 secret-handling rules — its presence/rotation status is unchanged from
what `docs/status/KNOWN_RISKS.md` already discloses (returned in plaintext by Paddle's own API
response shape, not rotated as of the last check). Status: **verified-live**.

Public identifiers recorded above (price IDs, product IDs, notification-setting ID, client token
already present in `wrangler.jsonc`) are all already public/checked-into-source-control
identifiers per the project's own security model — none are secrets.

## 7. Public production route verification (read-only HTTP, 2026-08-03T10:20Z UTC)

| Check                                            | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://crawlpact.com/`                         | `200`, 0 redirects                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `https://www.crawlpact.com/`                     | `200`, resolves to `https://crawlpact.com/`                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `http://crawlpact.com/`                          | `200`, resolves to `https://crawlpact.com/` (HTTP→HTTPS working)                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Security headers                                 | HSTS (`max-age=63072000; includeSubDomains; preload`), CSP present (see below), `x-content-type-options: nosniff`, `x-frame-options: DENY`, `referrer-policy: strict-origin-when-cross-origin`, `permissions-policy` restrictive                                                                                                                                                                                                                                                 |
| CSP (`content-security-policy` header, homepage) | `script-src 'self' 'unsafe-inline' https://cdn.paddle.com https://www.googletagmanager.com`; `connect-src` includes `https://*.paddle.com https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com`; `frame-ancestors 'none'`; `object-src 'none'` — confirms Paddle.js and Google Analytics domains are both explicitly allow-listed in production, consistent with the documented GA deviation (see ANALYTICS_AND_CONSENT_BASELINE.md) |
| `robots.txt`                                     | `200`. `Allow: /` for all UAs; `Disallow: /api/`, `/audit/`, `/app`, `/sign-in`, `/dev/`; `Sitemap: https://crawlpact.com/sitemap.xml`                                                                                                                                                                                                                                                                                                                                           |
| `/sitemap.xml`                                   | `200`                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `/sitemap-index.xml`                             | `404` (not the sitemap filename this app uses — no conflict, just not the right path)                                                                                                                                                                                                                                                                                                                                                                                            |
| `/.well-known/security.txt`                      | `404` — **no `security.txt` currently served in production**                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `/status`                                        | `200`                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Nonexistent path                                 | `404` (custom 404 handling confirmed working)                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Server                                           | `cloudflare` (`cf-ray` header present, served from `SIN` colo at check time)                                                                                                                                                                                                                                                                                                                                                                                                     |

Status: **verified-live** for all rows above. `security.txt` absence noted as a gap, routed to
Phase 3 (Legal Identity, Contact, Security and Trust Foundation).

## 8. GitHub Actions / CI (production-adjacent)

- Latest `CI` workflow run against `main` at the current HEAD (`0d23f5a4b589ade5e14e7070aadb8607357c7d46`):
  **success** (`Merge when green` chain completed 2026-08-03T08:28:03Z, immediately preceding
  post-merge CI dispatch — see TEST_AND_CI_EVIDENCE.md for the full CI/CD breakdown).
- `main` branch has **no GitHub branch protection rule configured**
  (`GET /repos/rmtlbandara/CrawlPact/branches/main/protection` → `404 Branch not protected`,
  confirmed live 2026-08-03). This is a known, disclosed constraint of the repository's current
  GitHub plan (private repo, Free plan — branch protection/rulesets 403 per
  `.github/workflows/merge-when-green.yml`'s own header comment), not a newly discovered gap;
  cross-referenced in `docs/status/IMPLEMENTATION_STATUS.md`'s "Current real open items" section.
- `deploy-production.yml` is `workflow_dispatch`-only, requires a typed `"DEPLOY PRODUCTION"`
  confirmation string — no automatic path to production deployment exists. Status: **verified-live**
  (workflow file inspected directly at HEAD).

## 9. Verification limitations

- Cron trigger _execution history_ (as opposed to configuration) was not queried this pass —
  **not verified — required access was unavailable within this pass's scope.**
- Authenticated/admin route production behaviour was not verified via a live login this pass (no
  dedicated, pre-authorised test account was exercised) — see `ROUTE_INVENTORY.md`/
  `CAPABILITY_MATRIX.md` for per-route status; most are `code-present-not-production-verified`.
- Zone-level DNS/SSL/WAF/cache-rule configuration was not re-queried this pass (documented in
  `docs/deployment/CLOUDFLARE_CONFIGURATION.md` as needing manual dashboard review since the
  account's API token is zone-read-only) — carried forward as **verification-blocked**, not
  re-attempted.
