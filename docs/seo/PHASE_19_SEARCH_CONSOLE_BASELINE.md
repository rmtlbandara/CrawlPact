# Phase 19 Search Console Baseline

> **Superseded 2026-09-07 (Phase 20).** A Search Console property has since been connected (per
> evidence supplied for Phase 20's execution — see
> `docs/baseline/2026-09-07-phase20/SEARCH_CONSOLE_BASELINE.md` for the current state and
> `docs/risks/ACTIVE_RISKS.md`'s RISK-032 for its disposition). The record below remains accurate
> to what was true on 2026-08-14 and is preserved as history, not rewritten.

Status: historical (superseded by Phase 20, 2026-09-07). Records the Phase 19 attempt to connect
Search Console per §24-28.

## Attempt result

No Google-authenticated Search Console tool or session exists in this environment — confirmed by
searching all available tools before writing this document (no Search Console MCP tool, no OAuth
session available). This is unchanged from every prior phase that checked this (Phase 7, Phase 18,
the Phase 0-18 final reconfirmation pass).

No data below is fabricated. No verification, impression, click, or indexing figure is invented.

## What this means for RISK-032

RISK-032 remains `accepted (POST-LAUNCH)` exactly as recorded in `docs/risks/ACTIVE_RISKS.md`. Its
trigger — connecting a Search Console property — is unchanged: a one-time, low-effort, manual
product-owner action requiring their own Google account, not a code change.

## Exact owner action required (unchanged, cross-referenced)

See `docs/release/PHASE_18_SEARCH_CONSOLE_REQUIRED_ACTION.md` for the exact, current, step-by-step
manual setup instructions (Domain property for `crawlpact.com`, DNS TXT verification via
Cloudflare, sitemap submission at `https://crawlpact.com/sitemap.xml`, initial crawl review). That
document remains accurate and is not duplicated here.

## When access exists

A future session with real authenticated access should:

1. Verify ownership, sitemap submission/processing, indexing state, canonical behavior, HTTPS,
   structured-data issues, manual actions, and security issues (§26).
2. Record safe aggregates only (date range, clicks, impressions, CTR, average position, indexed
   page count, non-indexed reasons, top pages, top non-sensitive queries, device mix) — never raw
   per-user data, per §27.
3. Specifically measure the existing `/for/*`, `/platforms/*`, `/crawlers/*` pages (§63) before
   deciding whether further pages are justified.
4. Update this document with real data, replacing this "not yet connected" state.

## Content/indexing baseline without Search Console

In the absence of real search data, the only available proxy signals are: `pnpm run
content:links:check` (broken official-source link detection, passing) and `pnpm run
registry:public:validate` (22 content pages checked against 23 registry records, passing). Neither
substitutes for real indexing or query data — this is disclosed, not treated as equivalent.
