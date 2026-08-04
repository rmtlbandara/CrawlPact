# Sitemap and indexability policy (Phase 7 addendum)

`docs/seo/ROUTE_REGISTRY.md` remains the sitewide authoritative route/indexability table; this
document records the Phase 7-specific additions and rules.

## New routes

| Route                                                                                    | Indexable           | Rendering                                                       |
| ---------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------- |
| `/for/agencies`, `/for/publishers`, `/for/saas-and-documentation`, `/for/web-developers` | Yes                 | **SSR** (`prerender = false`), content collection (`verticals`) |
| `/platforms`                                                                             | Yes                 | Prerendered                                                     |
| `/platforms/[slug]` (5 priority, up to 5 extended)                                       | Yes, once published | Prerendered (content collection, `platforms`)                   |

**Why vertical pages are SSR, unlike guides/crawlers**: each vertical page's "pricing guidance"
section reads live pricing via `getPlanCatalog()` (the same Phase 6 single source of truth
`pricing.astro` itself reads) — a prerendered page has no live D1 binding at `astro build` time
(the exact constraint Phase 6 hit and documented for the homepage's pricing teaser; see
`apps/web/src/components/homepage/PricingPreviewSection.astro`'s doc comment). Rather than bake in
a snapshot that can go stale between deploys, vertical pages follow `pricing.astro`'s own
precedent (`export const prerender = false`) so pricing is always current. Platform guides
reference no pricing at all and remain prerendered, matching guides/crawlers exactly.

`apps/web/src/pages/sitemap.xml.ts` gains two new `getCollection()` calls (`verticals`,
`platforms`) alongside the existing `crawlers`/`guides` calls, plus `/platforms` added to
`STATIC_ROUTES` — the same pattern as every prior content-collection addition, so the sitemap can
never silently drift from what's actually published (unchanged mechanism, per
`docs/seo/ROUTE_REGISTRY.md`'s "Sitemap accuracy" section). `getCollection()` works identically
regardless of a given page's own prerender setting — the SSR vertical pages still contribute their
frontmatter to the sitemap exactly like a prerendered collection would.

## Indexability rule for deferred/unpublished platform guides

A `platforms` collection entry only exists in `src/content/platforms/` (and therefore only appears
in `getStaticPaths()`, the sitemap, and the hub page's link list) once it has actually passed
Phase 7's content-quality gate — there is no "draft" state visible in production. A deferred
platform guide (Stage 7D, if applicable) simply has no corresponding Markdown file yet; it cannot
accidentally leak into the sitemap or become indexable, because the file that would make that
possible doesn't exist. This is stricter than a `noindex`/draft-flag mechanism — it structurally
cannot happen.

## `robots.txt`

No change — `/for/` and `/platforms/` are not covered by any existing `Disallow` rule, and don't
need a new one (both are meant to be fully indexable). `apps/web/src/lib/robots-txt.test.ts`'s
existing assertions (no AI-crawler-specific blocks, only the pre-existing path-prefix
`Disallow`s) remain correct and unchanged.

## `lastmod`

Sitemap `lastmod` for each `/for/*`/`/platforms/*` entry uses `updatedDate ?? publishedDate` from
frontmatter — the same pattern `guides`/`crawlers` already use — never the build timestamp. A page
that hasn't been substantively reviewed does not get its `lastmod` bumped on an unrelated deploy.
