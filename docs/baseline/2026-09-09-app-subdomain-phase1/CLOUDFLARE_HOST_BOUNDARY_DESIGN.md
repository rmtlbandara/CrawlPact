# Cloudflare Host-Boundary Design — App-Subdomain Migration Phase 1

Date: 2026-09-09. This document satisfies the migration directive's hard gate: **prove that
`app.crawlpact.com` can never directly serve a prerendered public asset**, and design the
mechanism before Phase 2 implements it. Nothing in this document is implemented yet — Phase 1 is
design-only for this workstream, per the explicit instruction not to attach the app Custom Domain
until host enforcement exists.

Cloudflare documentation was re-verified live in this session (`search_cloudflare_documentation`,
accessed 2026-09-09) rather than assumed from training knowledge, per the directive's "fresh
external research is mandatory" rule.

## 1. The problem, precisely

- Production's `assets` block in `apps/web/wrangler.jsonc` has **no `run_worker_first` key** —
  Cloudflare's documented default (`run_worker_first: false`) applies: "if a requested URL matches
  a file in the static assets directory, that file will be served — without invoking Worker code."
- 27 of CrawlPact's ~228 page routes are `prerender = true` (all `PUBLIC_ONLY` marketing/content
  pages — confirmed via full `export const prerender` audit). Every one of them is a static HTML
  file in `apps/web/dist/client/` today.
- `middleware.ts` (hostname-aware logic would live here) and `worker.ts` (the Worker entrypoint)
  **only run when Astro's SSR handler runs** — which, per Cloudflare's documented routing
  behavior, only happens when no static asset matches. **A prerendered page never reaches either
  file on production today.**
- If `app.crawlpact.com` were attached as a second Custom Domain to this same Worker with no other
  change, a request for `app.crawlpact.com/about/` would match the exact same
  `dist/client/about/index.html` asset that `crawlpact.com/about/` serves — Cloudflare's asset
  matching has no concept of which Custom Domain the request arrived on, only the request path.
  **This would immediately create a duplicate, indexable-by-default copy of every public marketing
  page on the app host**, with none of the host-aware logic in `middleware.ts` ever running to stop
  it. This is the exact failure mode the directive's hard gate exists to prevent.
- Preview already proves the fix works: `env.preview.assets.run_worker_first: true` forces every
  preview request through `worker.ts` first, which is how preview's
  `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` stamp reaches prerendered pages too.
  Preview's own code comment documents a **confirmed, verified-live side effect**: enabling
  `run_worker_first` bypasses Cloudflare's edge-level `_redirects`/`html_handling` processing for
  asset-matched paths entirely (a bare `/about` request returned `200` directly instead of the 301
  `_redirects` declares — verified 2026-09-07). Preview's `needsTrailingSlashRedirectPreview()`
  exists specifically to compensate for this by re-implementing the trailing-slash redirect inside
  the Worker itself.

## 2. Cloudflare platform facts re-verified this session (2026-09-09)

- `run_worker_first` accepts either `true` (unconditionally invoke the Worker before any asset
  lookup) or **an array of glob route patterns** for selective Worker-first routing. Patterns
  support `*` for deep matching and a `!` prefix for negative/exclusion patterns; negative
  patterns take precedence regardless of list order. Example straight from current Cloudflare
  docs: `"run_worker_first": ["/api/*", "!/api/docs/*"]`.
- The array form supports up to 100 entries (duplicates count toward the limit) — far more than
  CrawlPact needs.
- `run_worker_first: true` is the mechanism Cloudflare itself recommends for "authentication
  checks... before serving static assets" — exactly this migration's requirement.
- Confirmed: `assets_navigation_prefers_asset_serving` (a separate compatibility flag affecting
  SPA-style fallback behavior) **has no effect when `run_worker_first: true` is set** — not
  relevant to CrawlPact's non-SPA architecture, but worth knowing it doesn't interact unexpectedly.
- Smart Placement + `run_worker_first: true` increases asset latency because all requests must
  reach the (possibly smart-placed, non-edge) Worker first — CrawlPact does not currently use
  Smart Placement (not found in `wrangler.jsonc`), so this caveat doesn't apply, but should be
  re-checked if Smart Placement is ever adopted.

## 3. Design decision (Phase 2 implementation target — not built in Phase 1)

Per the directive's preferred-hierarchy (§6.1), CrawlPact should use **selective, repository-governed
Worker-first routing**, not a blanket `true`, because a clean negative-exclusion set is provable
and small:

```jsonc
// apps/web/wrangler.jsonc — PRODUCTION `assets` block, Phase 2 target (NOT applied in Phase 1)
"assets": {
  "directory": "./dist",
  "binding": "ASSETS",
  "run_worker_first": [
    "/*",
    "!/_astro/*",      // hashed JS/CSS bundles — content-addressed, safe to serve identically from any host
    "!/branding/*",    // static repo-committed branding assets (favicon/logo variants)
    "!/og/*",          // static Open Graph images
    "!/favicon.png",
    "!/og-image.svg"
  ],
}
```

This mirrors the exact pattern Cloudflare's own docs demonstrate (`["/api/*", "!/api/docs/*"]`) —
worker-first for every _document/navigation_ path, asset-first only for genuinely immutable,
non-HTML, non-hostname-sensitive build output. None of the excluded paths are HTML documents, so
this satisfies the directive's explicit constraint: "do not exclude an HTML/document path merely
for performance."

**Why not selective coverage limited to just the app-owned paths instead of `/*`?** Because the
threat isn't "the Worker needs to run for app-owned paths" — it's "the Worker needs to run for
_every_ document request on _both_ hosts so it can check the Host header before any asset lookup
happens." A pattern scoped only to `/app/*`/`/admin/*`/etc. would still let
`app.crawlpact.com/about/` (a `PUBLIC_ONLY` path requested on the wrong host) fall through to
asset-first serving unchecked. `/*` (minus the small immutable-asset exclusion list above) is the
only pattern that actually closes the gap, and it is small, static, and testable — exactly what
the directive's item 1 in the preferred hierarchy asks for ("broad page/navigation coverage with
explicit negative exclusions for immutable build assets when that can be proven complete").

### 3.1 What the Worker must do, once it runs first on production too

`worker.ts`'s `fetch` handler (today: `fetchWithPreviewSearchIsolation`, preview-only logic) needs
a **production-applicable** hostname classifier, added in Phase 2:

1. Read `request.headers.get("host")` (or `new URL(request.url).hostname`).
2. Classify against an **explicit allowlist** of exactly four trusted hostnames (production public,
   production app, preview public, preview app) plus `local`. Anything else — `workers.dev`,
   a typo'd hostname, an unexpected `Host` header — is treated as **untrusted**, never silently
   mapped to either surface. This directly satisfies the directive's "Workstream P" host-confusion
   and unknown-Worker-hostname-exposure threat items.
3. Resolve the request path against `ORIGIN_AND_ROUTE_OWNERSHIP_MATRIX.md`'s classification
   (extending `route-registry.ts`, which today only carries canonical-slash metadata, not
   ownership — see the Major Finding in that matrix document).
4. If the resolved owner doesn't match the trusted hostname the request arrived on:
   - `GET`/`HEAD` → 301/308 redirect to the owning hostname's equivalent URL (preserving path,
     query, and the Phase 20 trailing-slash contract).
   - any other method → reject with an explicit non-success response (never replay the mutation
     to another origin) — this is the directive's Wrong-Host Policy, applied uniformly.
5. Only after that check passes does the handler continue to Astro's `handle()` (which itself may
   defer to `env.ASSETS.fetch()` for the small immutable-asset exclusion list, or render SSR for
   everything else).
6. Because `run_worker_first` bypasses `_redirects`/`html_handling` for every asset-matched path
   it now covers, `worker.ts` must **re-implement the Phase 20 trailing-slash contract for
   production**, reusing (not duplicating) `needsTrailingSlashRedirectPreview()` — likely by
   renaming/generalizing that function once it's no longer preview-only.
7. Security headers must be re-verified as actually present on Worker-mediated static-document
   responses (the directive's explicit caution: "do not assume `public/_headers` behavior is still
   applied"). `public/_headers` continues to cover the small excluded immutable-asset set, which
   still bypasses the Worker exactly as it does today.

### 3.2 Cloudflare Custom Domain sequencing (unchanged from directive, reconfirmed)

`app.crawlpact.com` must **not** be attached as a Custom Domain until steps 3.1(1)-(6) are built,
tested, and deployed to the _existing_ Custom Domains (i.e., production already running
`run_worker_first` with host-enforcement code, serving only `crawlpact.com` and
`preview.crawlpact.com`, proven safe) — only then does attaching the new Custom Domain become a
config-only, low-risk action. This is a Phase 3 action, not Phase 1 or Phase 2.

DNS/Custom Domain state re-verified live via Cloudflare API this session: no record or Custom
Domain exists for `app.crawlpact.com` today, and no conflicting CNAME was found for it in the
`crawlpact.com` zone. When Phase 3 is ready, attaching it is a standard Custom Domain action
(Workers & Pages → `crawlpact-web` → Settings → Domains & Routes), identical in mechanism to how
`preview.crawlpact.com` was attached — Cloudflare provisions DNS/TLS automatically; no manual DNS
record should be created.

## 4. Alternative considered and deferred: edge Redirect Rule

The directive permits a Cloudflare dashboard Redirect Rule as an "explicitly documented edge
complement" (§6.1 item 4) if it "materially preserves static-asset performance and can be fully
tested/recorded." This is **not adopted as the primary mechanism** in this design: a
dashboard-only rule is invisible to the repository, can't be covered by
`route-registry.test.ts`-style regression tests, and would become exactly the "undocumented
dashboard-only dependency" the directive warns against. It remains available as a future,
separately-evaluated performance optimization (e.g., short-circuiting the most common wrong-host
GET redirects at the edge before they reach the Worker at all) — if adopted later, its exact rule
expression must be recorded in this document and covered by a documented manual test, per the
directive.

## 5. Explicitly deferred to Phase 2/3, not resolved here

- Exact array-pattern list is a _design target_; Phase 2 must re-derive it from the live
  `dist/client/` build output at implementation time (this document's exclusion list reflects the
  current `apps/web/public/` contents as of 2026-09-09 and may drift).
- Latency/Worker-invocation impact measurement (directive: "Measure latency and Worker-invocation
  impact before accepting") requires an actual preview deployment with the new config — not
  possible to produce as static evidence in Phase 1.
- Generalizing `needsTrailingSlashRedirectPreview()`/`route-registry.ts` into a real
  ownership-aware registry (today it only tracks canonical-slash metadata) is Phase 2 implementation
  work, scoped in `PHASE_2_TEST_CONTRACT.md`.
- The app-host `robots.txt`/`sitemap.xml` split (app host must never advertise a sitemap or allow
  crawling) is Phase 2 implementation, not designed byte-for-byte here — the ownership matrix
  records the requirement.
