# Phase 18 External Service Verification

Status: current-authoritative, 2026-08-14. Read-only verification against Cloudflare, Paddle, and
Google Analytics. No secrets, API tokens, or card data recorded. No real financial mutation
performed against any live account.

## Cloudflare

| Item                                                | Status                             | Evidence                                                                                                                                                                         |
| --------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worker (`crawlpact-web`)                            | verified                           | Deployed, version `7d79dfd1-7978-4ee1-ac99-4e43e7f23129`, matches `main` HEAD `5473410`.                                                                                         |
| D1 (`crawlpact-db`)                                 | verified                           | 54 tables, 36/36 migrations, 2.09 MB.                                                                                                                                            |
| Secret bindings present                             | verified                           | `ABUSE_MONITORING_SECRET`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `SESSION_SIGNING_SECRET` all bound. Rotation history: **verification-blocked** (API exposes no timestamp). |
| SSL/TLS mode, min TLS, HTTPS redirect, HSTS, DNSSEC | verification-blocked               | `401`/`403` via connected credential — unchanged since Phase 12/13 (RISK-003).                                                                                                   |
| Custom firewall/redirect rulesets                   | verified-manually (existence only) | Both rulesets confirmed to exist and be unchanged since prior findings; rule _contents_ verification-blocked.                                                                    |
| Cache/rate-limit rules                              | verification-blocked               | Same credential restriction.                                                                                                                                                     |
| AI Crawl Control state                              | not re-checked this pass           | No evidence of change since Phase 13's deliberate "leave unchanged" decision (ARC-030).                                                                                          |

## Paddle

| Item                         | Status                  | Evidence                                                                                                                                                     |
| ---------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Environment                  | verified                | Live production (not sandbox) — confirmed via `first_billed_at` populated on real subscriptions.                                                             |
| Product/price catalog        | verified                | 3 products, 9 prices (6 current + 3 legacy, correctly distinguished in `plan_prices` and correctly filtered by server-side checkout code).                   |
| Webhook signing              | not re-tested this pass | No fresh webhook delivery generated (would require a real event); prior verification (8 real signed events, 2026-07-28) stands, unchanged.                   |
| Current active subscriptions | verified (read-only)    | 2, both product-owner-account, confirmed in Phase 17 — not re-queried this pass to avoid unnecessary repeated reads of the same real customer-adjacent data. |
| Customer portal              | not exercised this pass | No functional change since last verification; out of this pass's narrow scope.                                                                               |

## Google Analytics

| Item           | Status   | Evidence                                                                                                                                                                                                                                                |
| -------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Measurement ID | verified | `G-1W5HP7S561`, unchanged.                                                                                                                                                                                                                              |
| Consent gating | verified | 16 tests (`ga-boundary.test.ts`, `consent.test.ts`) passing; live homepage confirmed no GA request fires before consent (structural guarantee, not re-tested with a live browser this pass — see accessibility/E2E suite for the automated equivalent). |

## Google Search Console

**No property connected.** No MCP tool or API credential is available to this session for Search
Console in any case — this item is `verification-blocked` even if a property existed. See
`docs/release/PHASE_18_SEARCH_CONSOLE_REQUIRED_ACTION.md` for the exact manual steps required.
Per §103, Gate F ("Public-growth-ready") cannot be marked complete while this remains unresolved,
independent of the Gate E hold.
