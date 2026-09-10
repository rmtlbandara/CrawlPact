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
 * route. `wrangler.jsonc` sets `run_worker_first` for both preview
 * (`true`) and, since Phase 2 of the app-subdomain migration (ADR-0010),
 * production too (a selective array) — either setting has the same
 * confirmed side effect: it bypasses Cloudflare's edge-level
 * `_redirects`/`html_handling` processing for asset-matched paths entirely
 * (verified locally, 2026-09-07 — with `run_worker_first` enabled, a bare
 * `/about` request returned 200 directly instead of the 301 `_redirects`
 * declares, because the Worker's own internal asset lookup doesn't re-run
 * the edge dispatcher's redirect rules). `worker.ts` therefore needs its
 * own Worker-level trailing-slash redirect covering prerendered paths too,
 * in every environment that sets `run_worker_first`, or it would silently
 * regress the exact canonical-URL defect Phase 20 fixed. (Despite the
 * name — kept for now to avoid an unrelated rename — this covers
 * production as much as preview.)
 */
export function needsTrailingSlashRedirectPreview(pathname: string): boolean {
  if (pathname === "/" || pathname.endsWith("/")) return false;
  if (PRERENDERED_ROUTES.includes(pathname)) return true;
  if (PRERENDERED_COLLECTION_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return needsTrailingSlashRedirect(pathname);
}

/**
 * A request path that Cloudflare's Static Assets binding will resolve to
 * `route`'s real underlying file (`<route>/index.html`) via a synonym
 * other than the canonical trailing-slash form — verified live against
 * production, 2026-09-09, before this function existed: `/about/index.html`,
 * `/about/index`, and `/about.html` all returned the real page directly
 * (200, no redirect), because `run_worker_first` routes them to this
 * Worker like any other path, and — unlike the plain bare form `/about`,
 * which `needsTrailingSlashRedirectPreview` already recognized — nothing
 * recognized these as needing a redirect at all, so they fell through to
 * `handle()`'s Astro-routing-miss fallback, which serves the literal static
 * file (Cloudflare's default `html_handling: auto-trailing-slash` resolves
 * all three forms to the same asset key). Every generated prerendered page
 * is confirmed to be named exactly `index.html` (never `<name>.html`) —
 * see `apps/web/dist/client/**\/*.html` — so this covers the complete
 * literal-alias surface for every prerendered route this registry owns.
 */
const INDEX_ALIAS_SUFFIXES = ["/index.html", "/index", ".html"];

/**
 * If `pathname` is a Static Assets alias (see `INDEX_ALIAS_SUFFIXES`'s doc
 * comment) of a page this registry actually owns — an exact
 * `PRERENDERED_ROUTES`/`SSR_INDEXABLE_ROUTES` entry, the site root, or a
 * `PRERENDERED_COLLECTION_PREFIXES`-owned detail/collection page — returns
 * that page's real canonical path (always trailing-slash-terminated, `/`
 * for the root). Returns `null` for everything else, including a path that
 * merely *looks* alias-shaped but isn't a route this registry owns
 * (`/app/index.html`, `/api/foo.html`, `/sign-in/index`): this function
 * only recognizes a known synonym for an *already-registered* route, it
 * never invents ownership — callers that gate a security/classification
 * decision on this (`route-ownership.ts`'s `isPublicOnlyPath`) stay exactly
 * as precise as before for every path this returns `null` for.
 *
 * SSR routes/prefixes are deliberately excluded from the alias check even
 * though they're in scope for `needsTrailingSlashRedirect`: they're
 * rendered on demand and have no literal file in the Assets store at all
 * (confirmed live: `/pricing/index.html` 404s, it was never a bypass
 * vector), so there is no alias surface to recognize for them.
 */
export function resolveStaticAssetAlias(pathname: string): string | null {
  if (pathname === "/index.html" || pathname === "/index") return "/";

  for (const suffix of INDEX_ALIAS_SUFFIXES) {
    if (!pathname.endsWith(suffix)) continue;
    const base = pathname.slice(0, -suffix.length);
    if (!base) continue; // "/index.html" / "/index" already handled above.
    if (PRERENDERED_ROUTES.includes(base)) return `${base}/`;
    if (PRERENDERED_COLLECTION_PREFIXES.some((prefix) => base.startsWith(prefix)))
      return `${base}/`;
  }
  return null;
}

/**
 * The single canonical-redirect resolver for any request path that would
 * otherwise bypass Astro's SSR routing — a prerendered page served
 * straight off the Workers Assets binding, in either its bare form
 * (`/about`) or any literal Static Assets alias of it
 * (`/about/index.html`, `/about.html`, `/crawlers/gptbot/index`, ...) —
 * plus the SSR bare-path case `needsTrailingSlashRedirectPreview` already
 * covered. Returns the exact trailing-slash destination to redirect to, or
 * `null` if `pathname` needs no redirect at all. Resolves in one hop:
 * `/crawlers/gptbot/index.html` canonicalizes directly to
 * `/crawlers/gptbot/`, never through an intermediate
 * `/crawlers/gptbot/index.html/`-shaped URL (the exact bug this function
 * replaces — the old bare-append logic didn't distinguish a real
 * `PRERENDERED_COLLECTION_PREFIXES` slug from an alias suffix landing under
 * the same prefix, and appended a trailing slash to the alias verbatim).
 * `worker.ts`'s two call sites (the apex/shared trailing-slash enforcement,
 * and the app-host public-ownership redirect-target construction) both go
 * through this one function so they can never independently drift.
 */
export function resolveCanonicalRedirectTarget(pathname: string): string | null {
  if (pathname === "/" || pathname.endsWith("/")) return null;
  const alias = resolveStaticAssetAlias(pathname);
  if (alias) return alias;
  if (needsTrailingSlashRedirectPreview(pathname)) return `${pathname}/`;
  return null;
}
