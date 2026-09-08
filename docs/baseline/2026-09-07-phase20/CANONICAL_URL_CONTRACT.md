---
Document owner: Engineering owner
Status: current-authoritative
Date: 2026-09-07
---

# Canonical URL contract (Phase 20)

## Rule

> **Trailing slash is canonical for every indexable CrawlPact page except the site root.**
> Scheme: `https`. Host: `crawlpact.com` (apex, not `www`). Query strings are never part of a
> canonical identity for a marketing page.

Every one of: the `<link rel="canonical">` value, the `sitemap.xml` entry, the internal-link
target, the breadcrumb `item` URL, `og:url`, and the JSON-LD node URL must be the exact same
string for a given page.

## Evidence this decision was based on (fresh, 2026-09-07)

Direct production `curl` checks (not assumptions) found the canonicalization was already
**partially** in place, in an inconsistent and non-permanent way, before this phase:

| Page type                       | Example               | Bare-path response (before)        | Slash-form response   |
| ------------------------------- | --------------------- | ---------------------------------- | --------------------- |
| Prerendered (static asset)      | `/about`              | `307` → `/about/`                  | `200`                 |
| Prerendered, content collection | `/crawlers/amazonbot` | `307` → `/crawlers/amazonbot/`     | `200`                 |
| SSR (on-demand)                 | `/pricing`            | `200` (independently, no redirect) | `200` (independently) |
| SSR, content collection         | `/for/agencies`       | `200` (independently)              | `200` (independently) |

The prerendered-page 307 comes from Cloudflare Workers Static Assets' default
`html_handling: "auto-trailing-slash"` behavior (confirmed via
`https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/`):
`foo/index.html` is served _with_ a trailing slash, and a bare request for `foo` is redirected to
it — but as a **307 Temporary Redirect**, which Google's canonicalization guidance treats
differently from a permanent move.

The SSR pages had **no redirect of any kind** — `/pricing` and `/pricing/` were two independently
`200`-serving URLs for the same content. This is a real duplicate-URL defect the original seed
evidence for this phase didn't call out (it only flagged the slash/non-slash _measurement_ split
already visible in Search Console for prerendered pages like the robots.txt validator and
Amazonbot) — found only by directly testing every route category against production.

Choosing trailing-slash-canonical (rather than the reverse) matches:

- what Cloudflare's static-assets binding already does by default for every prerendered page;
- how every content-collection route (`/crawlers/:slug/`, `/guides/:slug/`, `/platforms/:slug/`,
  `/for/:slug/`) was already being built and linked internally;
- the sampled Search Console evidence in the original seed data, where the trailing-slash variant
  already had _more_ impressions than the bare form for both examples given (Amazonbot: 232 vs.
  14; the robots.txt validator: 209 vs. 149) — Google was already leaning toward the slash form.

A uniform site-wide policy (rather than per-template rules) was chosen because it can be
enforced from one shared source of truth (below) without any per-page exceptions, and it required
touching the smaller side of the route inventory (prerendered pages already redirected this way;
only ~21 static routes' sitemap entries and ~9 SSR routes needed a code change).

## Enforcement mechanism (two mechanisms, because CrawlPact has two rendering modes)

Single source of truth: `apps/web/src/lib/route-registry.ts`. It exports `PRERENDERED_ROUTES`,
`SSR_INDEXABLE_ROUTES`, `SSR_INDEXABLE_PREFIXES`, and `PRERENDERED_COLLECTION_PREFIXES` — the
same lists every enforcement point below reads, so they cannot drift apart.

### Prerendered pages → `apps/web/public/_redirects`

Prerendered pages are served directly off the Workers Assets binding under default routing and
never reach a Worker at all, so a redirect has to be declared where Cloudflare's edge dispatcher
reads it: a `_redirects` file (documented at
`https://developers.cloudflare.com/workers/static-assets/redirects/`), which supports an explicit
status code — used here to force `301` instead of the default `307`. `route-registry.test.ts`
asserts every `PRERENDERED_ROUTES` entry has a matching rule, so the file cannot silently drift
from the registry.

### SSR pages → `apps/web/src/middleware.ts`

SSR pages have no static asset at all, so nothing redirected them before. `middleware.ts` now
301-redirects a GET/HEAD request for a bare path in `SSR_INDEXABLE_ROUTES`/`SSR_INDEXABLE_PREFIXES`
to its trailing-slash form, one hop, before calling `next()`. Scoped to an explicit allowlist (not
a blocklist) so it can never touch `/api/*`, `/app/*`, `/admin/*`, `/sign-in`, `/pay`, `/audit/*`,
or any other mutating/authenticated route — see `middleware.test.ts`'s
"never touches API, app, admin, auth, sign-in, pay, or audit routes" test.

### A third mechanism was required: preview's `run_worker_first`

`wrangler.jsonc` sets `env.preview.assets.run_worker_first: true` so preview's Worker can stamp
every response with a search-isolation header regardless of rendering mode (see
`PREVIEW_SEARCH_ISOLATION.md`). Verified locally (`wrangler dev --local` against a real
`CLOUDFLARE_ENV=preview` build): **`run_worker_first` bypasses `_redirects`/`html_handling`
entirely for asset-matched paths** — a bare `/about` request returned `200` directly instead of
the `301` `_redirects` declares, because the Worker's own internal asset lookup doesn't re-run the
edge dispatcher's redirect rules. Left unfixed, enabling `run_worker_first` for preview's P0
search-isolation would have silently reintroduced the exact canonical-URL defect this phase closed,
on preview only.

Fixed by giving preview's Worker (`fetchWithPreviewSearchIsolation` in `worker.ts`) its own
trailing-slash check — `needsTrailingSlashRedirectPreview`, which covers `PRERENDERED_ROUTES` and
`PRERENDERED_COLLECTION_PREFIXES` in addition to everything `middleware.ts` covers — run _before_
`handle()` is ever called. Production does not set `run_worker_first` and is unaffected; this
extra check only ever executes when `PUBLIC_APP_ENV === "preview"`.

## Live verification (2026-09-07)

Production, direct `curl`:

```
http://crawlpact.com/            -> 301 -> https://crawlpact.com/            (http->https, pre-existing)
https://www.crawlpact.com/       -> 301 -> https://crawlpact.com/            (www->apex, pre-existing)
```

Local, `wrangler dev --local` against a real production-target build (real workerd runtime, real
Assets binding, real `_redirects` parsing — not Astro's dev server, which does not exercise any of
this):

```
GET /about               -> 301 -> /about/
GET /pricing              -> 301 -> /pricing/
GET /crawlers/amazonbot   -> 301 -> /crawlers/amazonbot/
GET /for/agencies         -> 301 -> /for/agencies/
GET /about/               -> 200
POST /api/audit           -> untouched by the redirect logic (confirmed via unit test; a real POST returned its normal 403, not a redirect)
```

Local, `wrangler dev --local` against a real `CLOUDFLARE_ENV=preview` build (before the
`needsTrailingSlashRedirectPreview` fix): `/about` returned `200` directly — the regression
described above, caught during this same verification pass and fixed before this phase closed.

## What changed in the automated test suite

`apps/web/tests/e2e/seo-metadata.spec.ts` previously normalized away the trailing slash before
comparing a page's canonical tag to its served URL — explicitly because "canonical generation is
inconsistent across page types today" (its own comment, and `docs/status/KNOWN_RISKS.md`'s
matching entry). That tolerance is now removed: the test asserts the canonical tag and the served
URL both equal the sitemap-declared path _exactly_, with no normalization, so future canonical
drift fails CI instead of being silently accepted.
