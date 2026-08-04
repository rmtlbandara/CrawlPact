# Phase 7 search/performance baseline

## Google Search Console: no property connected

There is no Google Search Console property connected to this domain — confirmed by searching this
repository and its docs for any GSC credential, property ID, or integration reference (none
exist), consistent with `docs/seo/ROUTE_REGISTRY.md`'s existing disclosure that
`www.crawlpact.com`/canonical-redirect DNS configuration is itself not yet connected to a live
Cloudflare account. Phase 7 does not change this. Per the phase prompt's own allowance for this
exact situation, this document provides a manual verification checklist instead of a live GSC
before/after comparison.

### Manual verification checklist (to run once a Search Console property exists)

- [ ] Submit `/sitemap.xml` (already includes every `/for/*` and `/platforms/*` URL — verified via
      the sitemap-driven `apps/web/tests/e2e/seo-metadata.spec.ts` run recorded in the Phase 7
      completion report).
- [ ] Request indexing for `/platforms` (hub) and each of the 9 new pages individually, rather than
      waiting for organic discovery, since they're net-new URLs with zero existing backlink/crawl
      history.
- [ ] After indexing, check the Coverage report for any "Discovered — not indexed" or "Crawled —
      not indexed" status on the 9 new URLs; if present, check whether `robots.txt`/`noindex` is
      the cause (it should not be — see `docs/seo/SITEMAP_AND_INDEXABILITY_POLICY.md`) before
      assuming a content-quality signal.
- [ ] Check the URL Inspection tool's rendered HTML for one `/for/*` page (SSR) and one
      `/platforms/*` page (prerendered) to confirm Googlebot receives the same JSON-LD/breadcrumb
      output `seo-metadata.spec.ts` already verified against the origin directly.
- [ ] After ~2-4 weeks of indexing, check the Performance report for impressions on the query
      themes recorded in `docs/seo/SEARCH_INTENT_AND_PAGE_MAP.md` (e.g. "AI crawler policy for
      agencies", "Cloudflare AI crawler policy") to see whether real query volume matches the
      pre-publication intent research, and record the result as a dated addendum to this file.
- [ ] Re-run `pnpm run content:links:check` at least every 90 days (matching the platform-guide
      review cadence in `docs/seo/CONTENT_FRESHNESS_AND_REVIEW_POLICY.md`) to catch an official
      source going offline before a visitor or crawler does.

## Lighthouse lab baseline (what could be measured this session)

`scripts/lighthouse-check.mjs`'s `PAGES` array was extended with one representative Phase 7 page
per template archetype — `/for/agencies` (the new SSR content-collection template) and
`/platforms/cloudflare` (the new prerendered platform-guide template) — alongside the three
pre-existing pages it already checked (`/`, `/pricing`, `/crawlers/amazonbot`). This script is
designed to run against a real deployed Worker (`.github/workflows/deploy-preview.yml` invokes it
against the preview Worker after every deploy) — it has never been a local-dev-server check.

Run this session against the local Astro dev server anyway, for a same-environment relative
comparison (not a production measurement):

```
node scripts/lighthouse-check.mjs http://localhost:4321
```

| Path                                 | Performance | Accessibility | Best Practices | SEO |       LCP | CLS |
| ------------------------------------ | ----------: | ------------: | -------------: | --: | --------: | --: |
| `/` (pre-existing)                   |          49 |           100 |             96 |  92 | 67,725 ms |   0 |
| `/pricing` (pre-existing)            |          44 |           100 |            100 |  92 | 10,217 ms |   0 |
| `/crawlers/amazonbot` (pre-existing) |          42 |           100 |            100 |  92 | 12,771 ms |   0 |
| `/for/agencies` (Phase 7)            |          43 |           100 |            100 |  92 | 13,073 ms |   0 |
| `/platforms/cloudflare` (Phase 7)    |          42 |           100 |            100 |  92 | 13,217 ms |   0 |

**Reading these numbers correctly**: every page — new and pre-existing alike — fails this
project's production thresholds (performance ≥85, LCP ≤3000ms) when served from the unbundled
Astro dev server, which serves many small unminified module requests instead of the optimised,
minified, CDN-served output a real deploy produces. This is a known dev-server artifact, not a
production measurement, and this file does not claim otherwise.

What this table does support: **Phase 7's two new templates score identically to the existing
templates on every metric that isn't dev-server-latency-dependent** — Accessibility 100/100 and
CLS 0/0 across all five, SEO 92/92 across all five (unaffected by JS delivery), Best Practices
100/100 matching `/pricing`/`/crawlers/amazonbot` exactly (only the home page differs, at 96, for a
pre-existing reason unrelated to this phase). This is real evidence that the new templates
introduce no accessibility, SEO-metadata, or layout-shift regression relative to the established
baseline — it is not evidence about production load performance, which requires the real
preview-Worker run this repository's existing CI workflow already performs on every deploy and
will run again the next time this branch's preview environment builds.

## Real production Lighthouse run (post-deploy, 2026-08-04)

Phase 7 deployed to production the same day (Worker `630258b4-c020-4105-9ca3-550897f7c0e3`). Ran
`node scripts/lighthouse-check.mjs https://crawlpact.com` directly against the live site —
genuine production numbers, not a dev-server artifact:

| Path                                 | Performance | Accessibility | Best Practices | SEO |      LCP | CLS |
| ------------------------------------ | ----------: | ------------: | -------------: | --: | -------: | --: |
| `/` (pre-existing)                   |          79 |           100 |             92 | 100 | 4,653 ms |   0 |
| `/pricing` (pre-existing)            |          99 |           100 |             92 | 100 | 1,787 ms |   0 |
| `/crawlers/amazonbot` (pre-existing) |          71 |           100 |             92 | 100 | 5,070 ms |   0 |
| `/for/agencies` (Phase 7)            |          73 |           100 |             92 | 100 | 4,788 ms |   0 |
| `/platforms/cloudflare` (Phase 7)    |          90 |           100 |             92 | 100 | 3,300 ms |   0 |

**Reading these numbers honestly**: 3 of the 5 pages fail the performance/LCP threshold
(performance ≥85, LCP ≤3000ms) — `/`, `/crawlers/amazonbot`, and `/for/agencies`. This is **not** a
Phase-7-specific regression: `/for/agencies` (73/100, 4,788ms) performs almost identically to the
pre-existing, unmodified `/crawlers/amazonbot` (71/100, 5,070ms), and `/platforms/cloudflare`
(Phase 7's other new template) actually outperforms both of those pre-existing pages at 90/100,
missing only the LCP threshold by 300ms. `/pricing` is the outlier in the other direction (99/100).
Accessibility (100/100), Best Practices (92/92), SEO (100/100), and CLS (0/0) are identical across
every page tested, new and old alike — confirming Phase 7 introduced no accessibility, structured-
data, or layout-shift regression.

**Real finding, disclosed, not Phase-7-scoped to fix**: this is the first time `lighthouse-check.mjs`
has been run directly against `https://crawlpact.com` — CI only ever runs it against the _preview_
Worker (`deploy-preview.yml`), never production, so this site-wide performance/LCP gap was
previously unmeasured, not previously passing. Recorded as RISK-033, routed to Phase 11 (Database,
Storage, Retention and Performance Hardening) — the phase that already owns performance work —
rather than attempted as an out-of-scope fix here.
