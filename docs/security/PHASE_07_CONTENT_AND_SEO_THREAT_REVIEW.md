# Phase 7 threat review: vertical landing pages and platform SEO architecture

Scope: the new surface added in Phase 7 — `/for/[slug].astro` (SSR), `/platforms/[slug].astro`
and `/platforms/index.astro` (prerendered), the `verticals`/`platforms` content collections
(`apps/web/src/content.config.ts`), `sitemap.xml.ts`'s two new `getCollection()` calls, and the
new `SiteHeader`/`SiteFooter`/homepage links into these pages. It does not re-review
authentication, billing, checkout, the scanner/safe-fetch chokepoint, or crawler-evaluation logic
— none of which this phase touches (see "What this phase deliberately does not change" below).

## What this surface lets a visitor do

Nothing new from a capability standpoint. Every new route is read-only marketing/reference
content, reachable anonymously, identical in kind to the pre-existing `/guides/*` and
`/crawlers/*` pages. No new form, no new mutating endpoint, no new authenticated surface, and no
new database write path were added by this phase.

## Input handling on the one new dynamic route

`/for/[slug].astro` is the only new SSR page (`export const prerender = false`, chosen because its
pricing-guidance block needs live `getPlanCatalog()` data — see
`docs/seo/SITEMAP_AND_INDEXABILITY_POLICY.md`). Its only visitor-influenced input is
`Astro.params.slug`, and it is used exactly once, as the key to `getEntry("verticals", slug)` — a
lookup against the fixed, build-time-known set of Markdown files in
`apps/web/src/content/verticals/`. An unrecognised slug returns `undefined`, the page sets
`Astro.response.status = 404`, and no other code path reads `slug` — there is no string
concatenation into a query, file path, shell command, or HTML attribute anywhere in the file
(confirmed by direct reading of `apps/web/src/pages/for/[slug].astro`; same pattern independently
verified in `apps/web/src/pages/platforms/[slug].astro`, whose `slug` is used identically).
`/platforms/[slug].astro` doesn't even take a runtime input: it's prerendered via
`getStaticPaths()` from `getCollection("platforms")`, so every valid path is generated at build
time and an invalid path never reaches application code at all — it 404s at the CDN/routing layer
before any component runs.

## Content is author-controlled, not visitor-controlled — no new XSS surface

All new page content (vertical copy, platform-guide copy, `officialSources` titles/URLs) comes
from Markdown files committed to this repository by the team, rendered through Astro's existing
trusted content-collection pipeline (`render(entry)` → `<Content />`), the same mechanism already
used for `guides`/`crawlers`. No visitor input is ever interpolated into these pages' HTML, and no
new `set:html`/`dangerouslySetInnerHTML`-style raw-HTML injection point was introduced — every
frontmatter field rendered in `[slug].astro` (title, description, audience, primaryProblem, plan
figures) goes through Astro's default JSX interpolation, which HTML-escapes by construction.

## External links (`officialSources`)

`/platforms/[slug].astro`'s "Official references" block renders `officialSources[].url` values as
real `<a>` targets with `rel="noopener noreferrer" target="_blank"` — the standard tab-nabbing
defence, applied here even though every current source is a first-party official-vendor
documentation URL populated by the team (`docs/seo/PLATFORM_CLAIM_SOURCE_REGISTER.md`), not
visitor-supplied. `scripts/content-validate.mjs` enforces every `officialSources` URL is `https://`
at commit time; `scripts/content-links-check.mjs` (run manually/on schedule, not part of `pnpm
quality` since it makes live network calls) catches a source going offline or moving after
publication.

## Reused, not duplicated, analytics endpoint

Both new pages' click-delegation `<script>` blocks POST to the existing `POST
/api/analytics/track` endpoint (unchanged this phase) — the same fire-and-forget,
error-swallowing, `keepalive: true` pattern already used on the homepage and guide pages since
Phase 4. This phase does not add a new endpoint, so it does not add a new rate-limiting gap: that
endpoint's pre-existing lack of rate limiting (noted in
`docs/security/PHASE_05_AUDIT_CONVERSION_THREAT_REVIEW.md`) is an unchanged, out-of-scope
condition, not something this phase introduces or worsens. The event payload sent is a
fixed, code-defined string (`eventName` from a `data-analytics-event` attribute the page itself
sets) — never free text a visitor typed.

## `mailto:` correction link

`/platforms/[slug].astro`'s "Report an inaccuracy" block is a static `mailto:support@crawlpact.com`
link — no form, no server-side handling, no new endpoint. It carries no pre-filled visitor data
(no domain, no report content), so it cannot be used to inject content into an outbound email on
CrawlPact's behalf.

## Pricing data stays single-source

`/for/[slug].astro` reads `getPlanCatalog(db, env.PADDLE_ENVIRONMENT)` — the same Phase 6
single-source-of-truth call `pricing.astro` itself makes — rather than embedding a duplicated or
hard-coded figure. `scripts/content-validate.mjs` fails the build if any vertical page's Markdown
body contains a literal `$<digit>` pattern, specifically to prevent a future edit from
reintroducing a hard-coded price that could drift from the real Paddle catalog.

## Sitemap/indexability cannot leak an unpublished page

A `platforms`/`verticals` collection entry only becomes reachable (via `getStaticPaths()`,
`sitemap.xml.ts`, and the hub's link list) once its Markdown file exists in the repository — there
is no draft/staging flag that could be flipped or forgotten. The deferred Stage 7D guides (nginx,
apache, fastly, akamai, GitHub Pages) have no corresponding files, so they are structurally
absent from every one of those surfaces, not merely hidden behind a flag (see
`docs/seo/SITEMAP_AND_INDEXABILITY_POLICY.md`'s "Indexability rule for deferred/unpublished
platform guides").

## Public-trust rules (SRS §6.2-adjacent) verified for new content

`scripts/trust-validate.mjs`'s existing scan (`SCAN_DIRS` includes `apps/web/src`, which covers
`apps/web/src/content/verticals` and `apps/web/src/content/platforms`) already covers this phase's
new content for prohibited country/jurisdiction/address/registration/tax/negative-support-wording
patterns and non-approved contact addresses — re-run and passing (see the Phase 7 completion
report's evidence section). No new allowlist entries were needed.

## What this phase deliberately does not change

No crawler-evaluation logic, scanner/safe-fetch code, pricing/Paddle/checkout logic, monitoring-
frequency logic, authentication, or admin surface was touched. `getPlanCatalog()` is called
read-only, exactly as `pricing.astro` already calls it — this phase adds no new write path to
`plan_catalog` or any billing table. `POST /api/analytics/track` is called, not modified.
