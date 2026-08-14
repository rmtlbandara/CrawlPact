# Phase 18 Search Console Required Action

Status: current-authoritative, 2026-08-14. No Google Search Console property is connected to
`crawlpact.com` (unchanged since RISK-032 was first recorded, Phase 7). No coding agent has access
to Google Search Console — this requires the product owner's own Google account and manual setup.
Do not fabricate index counts, crawl-error data, or a `site:` search result as a substitute.

## Why this blocks Gate F specifically

Gate F is defined as "Public-growth-ready," not merely "the website returns 200." CrawlPact's new
`/for/*`, `/platforms/*`, `/observatory/*`, and `/research/*` pages cannot be confirmed indexed,
checked for crawl errors, or compared against real search performance without this. The product
can operate without it; it is not fully public-growth-ready under this roadmap while the gap
remains (§103).

## Exact manual steps for the product owner

1. Sign in to [Google Search Console](https://search.google.com/search-console) with the Google
   account that should own this property.
2. Add a property for `https://crawlpact.com` (Domain property preferred — covers `www`/non-`www`
   and `http`/`https` variants automatically; requires a DNS TXT record, which needs Cloudflare DNS
   access).
3. Verify ownership (DNS TXT record via Cloudflare, or the HTML-file/meta-tag method against the
   URL-prefix property type if DNS access isn't convenient).
4. Submit the sitemap: `https://crawlpact.com/sitemap.xml`.
5. Wait for initial crawl (typically hours to a few days).
6. Review: index coverage, any crawl errors, canonical-URL issues, robots.txt-blocking warnings,
   and the security/manual-actions panel.
7. Spot-check a handful of representative URLs (homepage, `/pricing`, one `/crawlers/*` page, one
   `/for/*` page, `/observatory`) via the URL Inspection tool.

## What a future session should do once this exists

Record in `docs/release/PHASE_18_EXTERNAL_SERVICE_VERIFICATION.md` (or its successor): property
identity, verification method, sitemap submission/acceptance state, and the date of the first
representative-URL indexing review — no private Google credentials, ever. Only then may Gate F be
marked complete (jointly with Gate E and every other launch-blocker resolution).
