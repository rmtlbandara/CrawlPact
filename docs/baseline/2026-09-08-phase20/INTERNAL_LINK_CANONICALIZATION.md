---
Document owner: Engineering owner
Status: current-authoritative
Date: 2026-09-08
---

# Internal link canonicalization (Phase 20, Day 2)

## Why this surfaced now

2026-09-07's canonical fix made every indexable route's canonical form unambiguous (trailing
slash, `/` excepted) and enforced it with a real redirect. Auditing internal links against that
now-authoritative registry (`apps/web/src/lib/route-registry.ts`) surfaced that **most of the
site's own internal navigation pointed at the non-canonical form** — meaning every one of those
links would now cost an avoidable redirect hop (previously, for SSR pages, they pointed at a page
that had no redirect at all and just rendered directly; for prerendered pages, they already
incurred a redirect before 2026-09-07 too — this was pre-existing, not newly introduced, for that
half of the site).

The real Search Console data pulled today independently corroborates this as a real, live
contributor to the fragmentation it measured — e.g. the homepage's own crawler-card links (see
below) pointed at the bare `/crawlers/amazonbot` form, one plausible source of the 14 (of 246)
impressions Google recorded against that non-canonical form.

## What was found and fixed

### 1. A genuine, isolated bug: the homepage's crawler links had no trailing slash at all

`apps/web/src/pages/index.astro`'s crawler-preview cards used
`href={`/crawlers/${crawler.id}`}` — inconsistent with every other content-collection link in the
codebase (guides, platforms, verticals, and the crawler directory's own listing all already used
the trailing-slash form). Fixed to `href={`/crawlers/${crawler.id}/`}`.

### 2. Sitewide: static internal links to indexable pages used the bare form

Systematic audit (`grep` for `href="/<route>"` and `href: "/<route>"` against every route in
`route-registry.ts`) found bare-form links across:

- **`SiteFooter.astro`** (rendered on every page) — 17 links across all four columns
- **`SiteHeader.astro`** (rendered on every page) — the audit CTA
- Homepage sections (`CrawlerPurposeSection`, `SampleReportSection`, `AgencySection`,
  `PricingPreviewSection`, `VerticalsSection`)
- `PricingPlans.tsx`, `AuditReportView.tsx`
- Cross-links inside `about.astro`, `contact.astro`, `privacy.astro`, `terms.astro`,
  `security.astro`, `acceptable-use.astro`, `methodology.astro`, `scoring.astro`, `status.astro`,
  `scanner.astro`, `changelog.astro`, every `tools/*.astro` page (including the tools hub's own
  per-tool `href` config array), `crawlers/index.astro`, `platforms/index.astro`,
  `platforms/[slug].astro`, `observatory/index.astro`, `research/index.astro`,
  `research/[slug].astro`, `404.astro`
- Authenticated `/app/*` pages linking **out** to the public `/pricing` page (the link target is
  public and canonical-relevant regardless of which page contains the link)

Fixed by appending the canonical trailing slash to every one of these — a mechanical,
attribute-value-only change (no anchor text, no visible wording changed).

### 3. Breadcrumb `url` fields — same defect, different property name, feeding both visible nav and JSON-LD

Every parent-level breadcrumb crumb (the intermediate items — "Crawler directory", "Guides",
"Platforms", "Free tools", "Observatory", "Use cases", etc.) used a bare `url:` value, while only
the leaf crumb (the current page) already had it right. `MarketingLayout.astro` renders the
visible breadcrumb nav directly from `crumb.url` (`href={crumb.url}`), and `BaseLayout.astro`
builds the `BreadcrumbList` JSON-LD `item` field from the same value — so this one defect affected
both the visible navigation and the structured data simultaneously, across every page with
breadcrumbs. Fixed the same way, in every `breadcrumbs={[...]}`/`breadcrumbs = [...]` declaration
across `apps/web/src/pages/**/*.astro`.

## What was deliberately not changed

- No anchor text, label, or visible wording was touched — only `href`/`url` attribute _values_.
- Links to non-indexable/private/mutating routes (`/app/*`, `/admin/*`, `/api/*`, `/sign-in`,
  `/pay`) were left untouched — confirmed by re-grepping after the fix.
- Dynamic per-item links that already used the correct trailing-slash form (guides, platforms,
  verticals detail-page cross-links) were left alone — only the one inconsistent case
  (`index.astro`'s crawler cards) needed a change.

## Verification

- `pnpm test:unit` — 525/525 pass. Two pre-existing tests asserted on the literal (bare) href
  source string as the expected/correct state
  (`site-footer-trust-links.test.ts`, `homepage-sections.test.ts`); both updated to expect the
  canonical trailing-slash form — the same kind of update 2026-09-07 made to
  `seo-metadata.spec.ts` for the same underlying reason (a test that encoded a prior, now-fixed
  defect as if it were correct behavior).
- `pnpm build` — clean, 0 errors.
- `wrangler dev --local` (real workerd runtime, real Assets binding): confirmed live —
  `/crawlers/amazonbot/` (from the homepage's own rendered HTML) returns `200` directly, and the
  footer's rendered HTML now emits `href="/pricing/"`, `href="/about/"`, `href="/contact/"`, etc.

## Files changed

48 files under `apps/web/src/` — see `git diff --stat`. All changes are single-token additions
(one trailing `/` per href/url value) plus two test-assertion updates.
