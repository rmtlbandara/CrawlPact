import {
  ALL_STATIC_INDEXABLE_ROUTES,
  PRERENDERED_COLLECTION_PREFIXES,
  resolveStaticAssetAlias,
  SSR_INDEXABLE_PREFIXES,
} from "./route-registry";

/**
 * Executable form of Phase 1's route/origin ownership contract
 * (`docs/baseline/2026-09-09-app-subdomain-phase1/ORIGIN_AND_ROUTE_OWNERSHIP_MATRIX.md`).
 *
 * This module answers exactly one question, needed by the Worker-level host
 * boundary (`worker.ts`): **is this path owned by the public surface**, i.e.
 * must it never be served — must instead redirect (GET/HEAD) or reject
 * (everything else) — when reached through the app origin? It reuses
 * `route-registry.ts`'s existing canonical-slash lists (the single source of
 * truth for which prerendered/SSR routes are indexable public content)
 * rather than re-encoding that list a second time, plus the handful of
 * public capability-URL/infra routes the ownership matrix classified
 * `PUBLIC_ONLY` that route-registry.ts has no reason to know about (it only
 * tracks *indexable* routes; `/audit/:id`, `/pay`, `/shared/:token`, etc. are
 * public but deliberately `noindex`).
 *
 * `robots.txt` is deliberately NOT included here — it needs surface-*specific
 * content* (the app host gets its own disallow-all robots.txt, not a
 * redirect to the public one; see `pages/robots.txt.ts`), not a redirect.
 * `sitemap.xml` needs no special handling at all: it's a build-time-fixed,
 * fully public, non-page resource (nothing to duplicate in search results),
 * so serving the identical file on either host is harmless and it is
 * intentionally left out of both this list and `pages/sitemap.xml.ts`.
 *
 * This does not yet enumerate every `APP_ONLY`/`SERVER_TO_SERVER_PUBLIC`/etc.
 * API family from the ownership matrix — Phase 2 doesn't need that level of
 * detail for the Worker boundary, because CSRF (`auth/same-origin.ts`) is
 * self-referential (checks a request's Origin against its own arrival
 * origin, not a per-route table) and because `crawlpact.com` continues to
 * serve every `APP_ONLY` page/API during the Phase 2/3 migration-compatibility
 * window by design (see `worker.ts`'s host-boundary doc comment). A fuller
 * registry can be added later if a concrete need for one arises.
 */

/** Exact-path public routes not already covered by route-registry.ts's indexable lists. */
const EXTRA_PUBLIC_EXACT_PATHS = new Set(["/audit", "/pay"]);

/** Prefix-matched public routes not already covered by route-registry.ts. */
const EXTRA_PUBLIC_PREFIXES = ["/audit/", "/shared/", "/feed/"];

const STATIC_INDEXABLE_SET = new Set(ALL_STATIC_INDEXABLE_ROUTES);

/**
 * True if `pathname` is owned by the public surface (`crawlpact.com`) and
 * must never be served directly through the app origin. Trailing-slash
 * insensitive: both `/about` and `/about/` match, since the app-host
 * enforcement in `worker.ts` runs *before* canonical trailing-slash
 * normalization and must catch either form. Also catches a genuine literal
 * Static Assets alias of an owned page (`/about/index.html`,
 * `/crawlers/gptbot.html`, ...) — found live, 2026-09-09, serving real
 * public HTML directly through `app.crawlpact.com` because this function
 * didn't yet recognize that shape at all; see `resolveStaticAssetAlias`'s
 * doc comment in `route-registry.ts` for why that alias surface exists and
 * why recognizing it can't weaken any other classification (it returns
 * `null`, changing nothing here, for any path this registry doesn't
 * already own).
 */
export function isPublicOnlyPath(pathname: string): boolean {
  const bare = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;

  if (bare === "/") return true;
  if (STATIC_INDEXABLE_SET.has(bare)) return true;
  if (EXTRA_PUBLIC_EXACT_PATHS.has(bare)) return true;

  for (const prefix of [
    ...PRERENDERED_COLLECTION_PREFIXES,
    ...SSR_INDEXABLE_PREFIXES,
    ...EXTRA_PUBLIC_PREFIXES,
  ]) {
    if (pathname.startsWith(prefix)) return true;
  }

  return resolveStaticAssetAlias(pathname) !== null;
}

/**
 * Path prefixes that are never valid on an unrecognized ("unknown") host —
 * see `worker.ts`'s host-boundary enforcement. Deliberately narrower than
 * the full `noindex` prefix list in `middleware.ts` (which also covers
 * `/audit/`, `/shared/`, `/dev/` — genuinely public or low-stakes internal
 * surfaces where an unrecognized Host header isn't a meaningful security
 * boundary) to avoid an unrelated behavior change beyond what Phase 1's
 * threat model actually called for: an unknown hostname must never become a
 * trusted *application/authentication* origin.
 */
export const SENSITIVE_PATH_PREFIXES = ["/admin", "/api/", "/app", "/sign-in"];

/**
 * Boundary-aware: `pathname` matches `prefix` only if it equals it exactly
 * or continues with a `/`. A naive `pathname.startsWith(prefix)` would
 * wrongly flag `/apparently-fine` (starts with `/app`) or `/sign-in-evil`
 * (starts with `/sign-in`) as sensitive.
 */
export function isSensitivePath(pathname: string): boolean {
  return SENSITIVE_PATH_PREFIXES.some((prefix) => {
    const normalized = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
    return pathname === normalized || pathname.startsWith(`${normalized}/`);
  });
}
