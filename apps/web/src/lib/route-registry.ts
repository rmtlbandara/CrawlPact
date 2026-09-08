/**
 * Phase 20 (docs/baseline/2026-09-07-phase20/CANONICAL_URL_CONTRACT.md):
 * single source of truth for CrawlPact's static (non-content-collection)
 * indexable routes and their canonical trailing-slash form. Every one of
 * these routes' canonical identity is "path + trailing slash" (the site
 * root is the sole exception — see docs/seo/SITEMAP_AND_INDEXABILITY_POLICY.md
 * for why trailing-slash was chosen: it already matched how Cloudflare's
 * static-assets binding serves every prerendered page, and how every
 * content-collection route (`/crawlers/:slug/`, `/guides/:slug/`, etc.) was
 * already built).
 *
 * Three consumers read this list so they cannot silently drift apart:
 *  - `sitemap.xml.ts` appends the trailing slash and lists these as canonical.
 *  - `middleware.ts` 301-redirects a bare request for one of the
 *    `SSR_INDEXABLE_*` entries to its trailing-slash form (SSR responses
 *    reach Astro middleware; see that file's doc comment).
 *  - `route-registry.test.ts` asserts `public/_redirects` carries a matching
 *    301 rule for every `PRERENDERED_ROUTES` entry (prerendered pages are
 *    served directly off the Workers Assets binding and never reach
 *    middleware at all, so their redirect has to live in `_redirects`
 *    instead — same reason `_headers` duplicates middleware's security
 *    headers for those pages).
 */

/** Prerendered pages — canonical redirect enforced via `public/_redirects`. */
export const PRERENDERED_ROUTES = [
  "/about",
  "/contact",
  "/audit",
  "/sample-report",
  "/crawlers",
  "/tools",
  "/tools/ai-crawler-checker",
  "/tools/robots-txt-ai-validator",
  "/tools/rsl-validator",
  "/tools/llms-txt-validator",
  "/tools/content-signals-checker",
  "/guides",
  "/platforms",
  "/methodology",
  "/scoring",
  "/observatory/methodology",
  "/security",
  "/privacy",
  "/terms",
  "/acceptable-use",
  "/limitations",
];

/** SSR pages (on-demand rendered) — canonical redirect enforced in `middleware.ts`. */
export const SSR_INDEXABLE_ROUTES = [
  "/pricing",
  "/status",
  "/changelog",
  "/scanner",
  "/observatory",
  "/observatory/registry",
];

/**
 * SSR, dynamic content-collection-backed routes — canonical redirect
 * enforced in `middleware.ts` via prefix match. `/research/` is included for
 * canonical-hygiene even though the collection is currently empty and
 * `/research` is deliberately excluded from the sitemap (Phase 16: nothing
 * published yet, see `sitemap.xml.ts`) — a redirect on an unpublished route
 * is harmless and avoids a second inconsistency appearing the day the first
 * publication ships.
 */
export const SSR_INDEXABLE_PREFIXES = ["/for/", "/research/"];

/** Prerendered, content-collection-backed routes — same `_redirects` mechanism as PRERENDERED_ROUTES. */
export const PRERENDERED_COLLECTION_PREFIXES = ["/crawlers/", "/guides/", "/platforms/"];

/** Every static indexable route, canonical form (trailing slash, "/" excepted). */
export const ALL_STATIC_INDEXABLE_ROUTES = ["/", ...PRERENDERED_ROUTES, ...SSR_INDEXABLE_ROUTES];

export function canonicalStaticPath(path: string): string {
  return path === "/" ? "/" : `${path}/`;
}

/**
 * SSR-only trailing-slash check (`middleware.ts`'s redirect). Prerendered
 * pages are excluded here on purpose — on production they're served
 * directly off the Workers Assets binding under default routing and never
 * reach Astro middleware at all (see `middleware.ts`'s doc comment), so
 * their redirect lives in `public/_redirects` instead.
 */
export function needsTrailingSlashRedirect(pathname: string): boolean {
  if (pathname === "/" || pathname.endsWith("/")) return false;
  if ((SSR_INDEXABLE_ROUTES as readonly string[]).includes(pathname)) return true;
  return SSR_INDEXABLE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Broader than `needsTrailingSlashRedirect`: also covers every prerendered
 * route. `wrangler.jsonc` sets `env.preview.assets.run_worker_first: true`
 * so preview's Worker (`worker.ts`) can stamp every response with a
 * search-isolation header, regardless of rendering mode — but that setting
 * has a real, confirmed side effect: it also bypasses Cloudflare's
 * edge-level `_redirects`/`html_handling` processing for asset-matched
 * paths entirely (verified locally, 2026-09-07 — with `run_worker_first`
 * enabled, a bare `/about` request returned 200 directly instead of the
 * 301 `_redirects` declares, because the Worker's own internal asset lookup
 * doesn't re-run the edge dispatcher's redirect rules). Preview therefore
 * needs its own Worker-level trailing-slash redirect covering prerendered
 * paths too, or it would silently regress the exact canonical-URL defect
 * Phase 20 fixed — on preview only. Production does not set
 * `run_worker_first`, so production is unaffected and keeps relying on
 * `public/_redirects` alone.
 */
export function needsTrailingSlashRedirectPreview(pathname: string): boolean {
  if (pathname === "/" || pathname.endsWith("/")) return false;
  if (PRERENDERED_ROUTES.includes(pathname)) return true;
  if (PRERENDERED_COLLECTION_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return needsTrailingSlashRedirect(pathname);
}
