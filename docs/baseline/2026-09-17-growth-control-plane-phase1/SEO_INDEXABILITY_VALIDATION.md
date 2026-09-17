---
Document owner: Engineering owner
Status: current-authoritative (Phase 1, Workstream 21/22 — SEO/indexability)
---

# SEO and Indexability Validation — 2026-09-17

## Scope of this pass

Nothing in this pass touched canonical-URL logic, `robots.txt`, the sitemap generator, redirect
rules, `X-Robots-Tag` handling, or the Preview/app-host indexability boundary — no file under
`lib/route-registry.ts`, `lib/origin.ts`, `lib/route-ownership.ts` (beyond adding one new, correctly
classified `/api/rum` entry — see `SECURITY_PRIVACY_VALIDATION.md`), `sitemap.xml.ts`, or `robots.txt.ts`
was modified. This workstream is therefore a regression check, not new implementation.

## Verified

- The full unit + integration suite (856 + 403 tests) includes this repo's own existing tests for
  canonical hrefs, sitemap contents, `robots.txt` behavior, `X-Robots-Tag` on Preview, and
  Preview/app-host route-ownership boundaries — all pass unchanged.
- `pnpm internal-link-canonical:check` (440 files) — **PASSED**: no internal link anywhere in the
  content tree points at a non-canonical URL.
- The new `/admin/growth` page: `export const prerender = false` (matches every other admin page,
  server-rendered, session-gated) and sits under `/admin/*`, already covered by the existing
  `isSensitivePath`/`APP_ONLY_PAGE_PREFIXES` boundary — it inherits the same non-indexable,
  auth-gated treatment as every other Super Admin page without any new code.
- The new `/api/rum` route: classified `SHARED_SAME_ORIGIN_SURFACE` in `route-ownership.ts`
  (verified by the existing "every real API route file classifies, never UNKNOWN" invariant test,
  which scans the actual `pages/api` directory) — an API route, not a page, so it has no
  indexability question in the first place.

## Sitemap decision — unchanged

One public sitemap (`https://crawlpact.com/sitemap.xml`) remains correct; the app host remains
non-indexable. Nothing in this pass adds genuinely public, canonical, indexable content to
`app.crawlpact.com` — `/admin/growth` is neither public nor meant to be indexed. No sitemap change
is warranted.

## Conclusion

No SEO/indexability regression is evidenced. Full re-validation against a live environment (GSC
property health, real crawl behavior) is part of Preview/Production validation, not something a
local check can establish.
