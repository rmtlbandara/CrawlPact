# Phase 18 Current Production Manifest

Status: current-authoritative evidence snapshot, captured 2026-08-14 directly against live
production (D1, Cloudflare API, Paddle API, `https://crawlpact.com`) — not derived from
documentation. No secrets recorded below.

## Repository / production alignment

| Item                            | Value                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `main` HEAD (at Phase 18 start) | `54734109df95f79f8809ad43862d7fd4135ce87a`                                                                                |
| Production deployed commit      | `54734109df95f79f8809ad43862d7fd4135ce87a` (Phase 17 deployment record, independently re-confirmed via Worker deploy log) |
| Drift                           | **None** — tested source = deployed source                                                                                |
| Production Worker               | `crawlpact-web`, version `7d79dfd1-7978-4ee1-ac99-4e43e7f23129`                                                           |
| Deployment mechanism            | `deploy-production.yml`, `workflow_dispatch` + typed `DEPLOY PRODUCTION` confirmation — unchanged, still manual           |

## Database

| Item                               | Value                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------ |
| D1 database                        | `crawlpact-db` (`dd295b75-7376-4f05-8c50-fb0a63cc3cee`), region APAC     |
| Migration state                    | 36/36 applied (`0036_customer_pilot.sql` latest)                         |
| Table count (live `sqlite_master`) | 54 application tables — matches `pnpm db:validate`'s local count exactly |
| File size                          | 2,093,056 bytes (≈2.0 MB)                                                |
| Read replication                   | disabled                                                                 |

## Registry / ruleset

| Item                            | Value                                                                 |
| ------------------------------- | --------------------------------------------------------------------- |
| Active crawler registry release | `2026.07.3` (unchanged since Phase 15/16/17 deploys)                  |
| Active ruleset release          | `2026.07.2`                                                           |
| Pending candidate release       | None activated this pass — per §58, not activated merely for Phase 18 |

## Pricing / Paddle

| Item                            | Value                                                                                                                                                                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paddle environment              | production (live), verified read-only                                                                                                                                                                                                                                                                   |
| Active products                 | 3 (Solo, Pro, Agency)                                                                                                                                                                                                                                                                                   |
| Active prices                   | 9 total — 6 current (`(Phase 6)` suffix, `active_for_new_checkout=1`, `legacy=0`) + 3 legacy (`active_for_new_checkout=0`, `legacy=1`, kept live in Paddle only so existing subscribers on the original annual-only price can keep renewing — see `docs/billing/LEGACY_PRICE_AND_SUBSCRIBER_POLICY.md`) |
| Server-side checkout resolution | Confirmed filters `activeForNewCheckout = true` (`apps/web/src/lib/billing/plan-catalog.ts`) — a new checkout can never resolve to a legacy price                                                                                                                                                       |
| Current live paid subscriptions | 2, both on the product owner's own Super Admin account (see `docs/pilot/REAL_PAID_CHECKOUT_VALIDATION_PROTOCOL.md`) — not customer-demand evidence                                                                                                                                                      |

## Cron / operations

| Item          | Value                                                                                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cron triggers | Configured via `wrangler.jsonc` (daily retention purge, monitoring sweep) — live Cloudflare Cron-trigger listing not independently re-pulled this pass (no material change expected; `/admin/operations` reflects current scheduler state) |

## Bindings

| Item                                                      | Value                                                                                                                                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1                                                        | `crawlpact-db` (above)                                                                                                                                                                |
| R2                                                        | Agency-logo bucket (unchanged)                                                                                                                                                        |
| KV                                                        | Session/rate-limit namespaces (unchanged)                                                                                                                                             |
| Secrets (`secret_text` bindings present, values not read) | `ABUSE_MONITORING_SECRET`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `SESSION_SIGNING_SECRET` — all 4 present; no rotation-timestamp evidence available via this API for any of them |

## Analytics / consent

| Item              | Value                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| GA measurement ID | `G-1W5HP7S561` (unchanged)                                                                                                |
| Consent gating    | Structurally verified unchanged (Phase 13 architecture; `ga-boundary.test.ts`/`consent.test.ts`, 16 tests, still passing) |

## Pilot / research state

| Item                         | Value                                                                 |
| ---------------------------- | --------------------------------------------------------------------- |
| Pilot cohorts / participants | 0 / 0 (confirmed live)                                                |
| Research publications        | 0 published (confirmed Phase 16 deploy verification, unchanged since) |

## Cloudflare zone-settings visibility (RISK-003, re-confirmed)

`SSL mode`, `always_use_https`, `min_tls_version`, HSTS (`security_header`), `DNSSEC`, and
`pagerules` all still return `401`/`403` (`9109 Unauthorized` / `10000 Authentication error`)
through the connected credential — unchanged from Phase 12/13. Zone-level custom rulesets list
IS readable: `http_request_dynamic_redirect` (v19, unchanged since 2026-07-26) and
`http_request_firewall_custom` (v18, unchanged since 2026-07-31) both still exist; their rule
contents remain unreadable via this credential (`403` on `GET /rulesets/{id}`). No change from
the prior finding — still requires manual dashboard verification, not fabricated as "verified."
