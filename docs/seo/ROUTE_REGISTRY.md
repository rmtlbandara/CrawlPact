# Route Registry

Every route in `apps/web/src/pages/`, its indexability, and rendering mode. Indexability is
enforced two ways: a `<meta name="robots" content="noindex">` tag (HTML pages, via each layout's
`noindex` prop) and, since Part 3 Step 16, an `X-Robots-Tag: noindex, nofollow, noarchive` header
set in `middleware.ts` for every response under a non-indexable path prefix — the header is the
only mechanism that reaches JSON API responses, which have no `<head>` to carry a meta tag.

**Canonical policy (Phase 20, 2026-09-07)**: trailing slash is canonical for every indexable route
except `/`. The `Rendering` column below determines _which_ mechanism enforces that: prerendered
routes redirect via `apps/web/public/_redirects` (301); SSR routes redirect via
`apps/web/src/middleware.ts` (301). Both read the same source of truth,
`apps/web/src/lib/route-registry.ts` — see
`docs/baseline/2026-09-07-phase20/CANONICAL_URL_CONTRACT.md` for the full decision record. This
table's `Rendering` column was corrected during that pass: `/pricing`, `/scanner`, and `/sign-in`
had drifted to say "Prerendered" after being changed to SSR in an earlier, undocumented phase —
each was independently reconfirmed against `apps/web/src/pages/*.astro`'s own `prerender` export
and, for the public ones, live production behavior.

| Route                                           | Indexable                                                               | Rendering                                                                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                             | Yes                                                                     | Prerendered                                                                                                                            |
| `/about`                                        | Yes                                                                     | Prerendered                                                                                                                            |
| `/audit`                                        | Yes                                                                     | Prerendered                                                                                                                            |
| `/audit/[auditId]`                              | No (meta+header)                                                        | SSR                                                                                                                                    |
| `/shared/[token]`                               | No (meta+header)                                                        | SSR                                                                                                                                    |
| `/pricing`                                      | Yes                                                                     | SSR (corrected, Phase 20 — was "Prerendered")                                                                                          |
| `/crawlers`, `/crawlers/[slug]` (×20)           | Yes                                                                     | Prerendered (content collection)                                                                                                       |
| `/tools`, `/tools/*` (5 validators)             | Yes                                                                     | Prerendered                                                                                                                            |
| `/guides`, `/guides/[slug]` (×20)               | Yes                                                                     | Prerendered (content collection)                                                                                                       |
| `/for/[slug]` (×4, Phase 7)                     | Yes                                                                     | SSR (content collection — reads live pricing, see below)                                                                               |
| `/platforms`, `/platforms/[slug]` (×5, Phase 7) | Yes                                                                     | Prerendered (content collection)                                                                                                       |
| `/methodology`                                  | Yes                                                                     | Prerendered                                                                                                                            |
| `/scoring`                                      | Yes                                                                     | Prerendered                                                                                                                            |
| `/scanner`                                      | Yes                                                                     | SSR (corrected, Phase 20 — was "Prerendered"; sets its own public `Cache-Control`)                                                     |
| `/changelog`                                    | Yes                                                                     | SSR (reads live registry release data)                                                                                                 |
| `/status`                                       | Yes                                                                     | SSR (reads live environment/config state)                                                                                              |
| `/observatory`, `/observatory/registry`         | Yes                                                                     | SSR (reads live registry/research data)                                                                                                |
| `/observatory/methodology`                      | Yes                                                                     | Prerendered                                                                                                                            |
| `/security`                                     | Yes                                                                     | Prerendered                                                                                                                            |
| `/privacy`                                      | Yes                                                                     | Prerendered                                                                                                                            |
| `/terms`                                        | Yes                                                                     | Prerendered                                                                                                                            |
| `/acceptable-use`                               | Yes                                                                     | Prerendered                                                                                                                            |
| `/limitations`                                  | Yes                                                                     | Prerendered                                                                                                                            |
| `/research`, `/research/[slug]`                 | Yes, once published (currently empty; excluded from sitemap, see below) | SSR                                                                                                                                    |
| `/404`                                          | No (meta)                                                               | Prerendered                                                                                                                            |
| `/sign-in`                                      | No (meta+header)                                                        | SSR (corrected, Phase 20 — was "Prerendered"; real session/passkey check)                                                              |
| `/pay`                                          | No (meta)                                                               | SSR                                                                                                                                    |
| `/app`, `/app/*`                                | No (meta+header)                                                        | SSR (real session check)                                                                                                               |
| `/admin`, `/admin/*`                            | No (meta+header)                                                        | SSR (real session+role check)                                                                                                          |
| `/dev/*`                                        | No (meta+header)                                                        | SSR                                                                                                                                    |
| `/api/*` (all)                                  | No (header only — no HTML `<head>`)                                     | SSR                                                                                                                                    |
| `/sitemap.xml`                                  | N/A                                                                     | Prerendered endpoint (live-sourced, see below)                                                                                         |
| `/robots.txt`                                   | N/A                                                                     | SSR endpoint (Phase 20 — was a static file; now environment-aware, see `docs/baseline/2026-09-07-phase20/PREVIEW_SEARCH_ISOLATION.md`) |

## Sitemap accuracy

`sitemap.xml.ts` is the authoritative live list of indexable pages — its static-route list is
imported from `apps/web/src/lib/route-registry.ts` (Phase 20 — the same source `middleware.ts` and
`public/_redirects` read for canonical redirects, so the three can't drift apart) plus
`getCollection("crawlers"/"guides"/"verticals"/"platforms")`, so it never silently drifts out of
sync with the content collections either. Every listed static route gets its canonical trailing
slash appended (`canonicalStaticPath()`); content-collection routes already build it in. `apps/web/tests/e2e/seo-metadata.spec.ts`
fetches this sitemap and asserts every listed page is actually indexable (no stray `noindex`),
has a unique title/description, exactly one `<h1>`, a correct canonical tag, and required Open
Graph tags — so this table is checked against reality on every e2e run, not just maintained by
hand.

## Why `/for/[slug]` is SSR, unlike every other content-collection route (Phase 7)

Every other content-collection page (`/crawlers/*`, `/guides/*`, `/platforms/*`) is prerendered.
`/for/[slug]` is the one exception — it reads live pricing via `getPlanCatalog()` for its
plan-guidance section, and a prerendered page has no D1 binding available at `astro build` time
(the same constraint Phase 6 documented for the homepage's pricing teaser). See
`docs/seo/SITEMAP_AND_INDEXABILITY_POLICY.md` for the full reasoning.

## Canonical redirects (SRS §9.2)

Not yet implemented — `www.crawlpact.com` and bare-`http` redirects are a Cloudflare-level
concern (DNS/redirect rules) configured at deploy time, not application code. No production
Cloudflare account is connected yet (`docs/deployment/CLOUDFLARE_CONFIGURATION.md`); tracked as a
pre-launch task in Part 3 Step 26 (production configuration preparation).
