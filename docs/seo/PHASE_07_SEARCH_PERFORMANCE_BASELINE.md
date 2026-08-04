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

## What still needs a genuine post-deploy check

Once this branch reaches the preview Worker (via the existing `deploy-preview.yml` CI job), the
production-representative Lighthouse numbers for `/for/agencies` and `/platforms/cloudflare` will
be available from that job's own log, gated at the same thresholds as every other page
(performance ≥85, accessibility ≥95, best-practices ≥85, SEO ≥90, LCP ≤3000ms, CLS ≤0.1) — this is
the number that actually matters, not the dev-server table above. If that run fails specifically on
one of the two new pages (and not the pre-existing three), that is a genuine Phase 7 regression to
investigate before merge; if all five fail or pass together, it reflects a shared, pre-existing
condition, not something this phase introduced.
