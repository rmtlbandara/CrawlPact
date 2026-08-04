# Structured data and metadata policy (Phase 7 addendum)

`docs/seo/STRUCTURED_DATA.md` remains the sitewide authoritative structured-data record; this
document only adds the Phase 7 rows and confirms no existing rule needed changing.

## New structured-data rows

| Type             | Where                                                       | Status                                                                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BreadcrumbList` | Every `/for/*` and `/platforms/*` page                      | Reuses the existing `BaseLayout.astro` mechanism — driven by the same `breadcrumbs` prop every guide/crawler page already uses, not a new implementation.                                                    |
| `Article`        | Every `/for/*` and `/platforms/*` page (`ogType="article"`) | Same existing `BaseLayout.astro` mechanism, `publishedDate`/`updatedDate` sourced from frontmatter — no fake author (per `docs/seo/EDITORIAL_SOURCE_AND_CONTENT_POLICY.md`, organizational authorship only). |

No `Product`, `Review`, `AggregateRating`, or `FAQPage` structured data was added to Phase 7 pages
— none of the new pages contain a visible FAQ block by default (per the phase prompt's "Do not add
FAQ schema by default" rule); a page that does add a visible FAQ section may add matching
`FAQPage` JSON-LD at that point, generated from the same array the visible accordion renders,
exactly like `index.astro`'s existing pattern — none do as of this phase's initial publication.

## Metadata rule (unchanged, re-confirmed)

Every Phase 7 page sets a unique `title`/`description` via the same `MarketingLayout` props every
other page uses — no shared default, no template-generated description that's identical across
multiple platform guides (this is the specific failure mode `pnpm content:validate`'s
title/description-uniqueness check exists to catch — see the Phase 7 addendum in
`docs/seo/SEO_CONTENT_GOVERNANCE.md`).

## Validation

`apps/web/tests/e2e/seo-metadata.spec.ts` (unchanged mechanism) fetches the live sitemap and checks
every listed page, including every Phase 7 page once published — so this isn't a separate,
unverified claim.
