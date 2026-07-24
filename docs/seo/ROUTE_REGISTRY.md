# Route Registry

Every route in `apps/web/src/pages/`, its indexability, and rendering mode. Indexability is
enforced two ways: a `<meta name="robots" content="noindex">` tag (HTML pages, via each layout's
`noindex` prop) and, since Part 3 Step 16, an `X-Robots-Tag: noindex, nofollow, noarchive` header
set in `middleware.ts` for every response under a non-indexable path prefix — the header is the
only mechanism that reaches JSON API responses, which have no `<head>` to carry a meta tag.

| Route                                 | Indexable                           | Rendering                                      |
| ------------------------------------- | ----------------------------------- | ---------------------------------------------- |
| `/`                                   | Yes                                 | Prerendered                                    |
| `/about`                              | Yes                                 | Prerendered                                    |
| `/audit`                              | Yes                                 | Prerendered                                    |
| `/audit/[auditId]`                    | No (meta+header)                    | SSR                                            |
| `/shared/[token]`                     | No (meta+header)                    | SSR                                            |
| `/pricing`                            | Yes                                 | Prerendered                                    |
| `/crawlers`, `/crawlers/[slug]` (×20) | Yes                                 | Prerendered (content collection)               |
| `/tools`, `/tools/*` (5 validators)   | Yes                                 | Prerendered                                    |
| `/guides`, `/guides/[slug]` (×20)     | Yes                                 | Prerendered (content collection)               |
| `/methodology`                        | Yes                                 | Prerendered                                    |
| `/scoring`                            | Yes                                 | Prerendered                                    |
| `/scanner`                            | Yes                                 | Prerendered                                    |
| `/changelog`                          | Yes                                 | SSR (reads live registry release data)         |
| `/status`                             | Yes                                 | SSR (reads live environment/config state)      |
| `/security`                           | Yes                                 | Prerendered                                    |
| `/privacy`                            | Yes                                 | Prerendered                                    |
| `/terms`                              | Yes                                 | Prerendered                                    |
| `/acceptable-use`                     | Yes                                 | Prerendered                                    |
| `/limitations`                        | Yes                                 | Prerendered                                    |
| `/404`                                | No (meta)                           | Prerendered                                    |
| `/sign-in`                            | No (meta+header)                    | Prerendered (static form; real auth backend)   |
| `/app`, `/app/*`                      | No (meta+header)                    | SSR (real session check)                       |
| `/admin`, `/admin/*`                  | No (meta+header)                    | SSR (real session+role check)                  |
| `/dev/*`                              | No (meta+header)                    | SSR                                            |
| `/api/*` (all)                        | No (header only — no HTML `<head>`) | SSR                                            |
| `/sitemap.xml`                        | N/A                                 | Prerendered endpoint (live-sourced, see below) |

## Sitemap accuracy

`sitemap.xml.ts` is the authoritative live list of indexable pages — it's driven by a hand-
maintained static-route array plus `getCollection("crawlers"/"guides")`, so it never silently
drifts out of sync with the content collections. `apps/web/tests/e2e/seo-metadata.spec.ts`
fetches this sitemap and asserts every listed page is actually indexable (no stray `noindex`),
has a unique title/description, exactly one `<h1>`, a correct canonical tag, and required Open
Graph tags — so this table is checked against reality on every e2e run, not just maintained by
hand.

## Canonical redirects (SRS §9.2)

Not yet implemented — `www.crawlpact.com` and bare-`http` redirects are a Cloudflare-level
concern (DNS/redirect rules) configured at deploy time, not application code. No production
Cloudflare account is connected yet (`docs/deployment/CLOUDFLARE_CONFIGURATION.md`); tracked as a
pre-launch task in Part 3 Step 26 (production configuration preparation).
