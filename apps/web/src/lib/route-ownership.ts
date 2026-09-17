import {
  ALL_STATIC_INDEXABLE_ROUTES,
  PRERENDERED_COLLECTION_PREFIXES,
  resolveStaticAssetAlias,
  SSR_INDEXABLE_PREFIXES,
} from "./route-registry";

/**
 * Executable form of the route/origin ownership contract, originally from
 * Phase 1 (`docs/baseline/2026-09-09-app-subdomain-phase1/ORIGIN_AND_ROUTE_OWNERSHIP_MATRIX.md`)
 * and extended by Phase 4's controlled production cutover
 * (`docs/baseline/2026-09-14-app-subdomain-phase4/FINAL_ROUTE_OWNERSHIP_MATRIX.md`).
 *
 * `isPublicOnlyPath` answers the question Phase 2 needed for the Worker-level
 * host boundary (`worker.ts`): **is this path owned by the public surface**,
 * i.e. must it never be served — must instead redirect (GET/HEAD) or reject
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
 * `isAppOnlyPagePath` and `classifyApiOwnership` (below) are the Phase 4
 * additions: the symmetric other half of the boundary Phase 2 deliberately
 * left open for the migration-compatibility window (`crawlpact.com`
 * continuing to serve `/sign-in`/`/app/**`/`/admin/**`/every `/api/**`
 * directly, alongside the app host). That window ended with Phase 4's
 * cutover — see `worker.ts`'s host-boundary doc comment for the full,
 * current five-decision enforcement order.
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

/**
 * Boundary-aware prefix match, shared by every check below: `pathname`
 * matches `prefix` only if it equals it exactly or continues with `/`.
 */
function matchesBoundary(pathname: string, prefix: string): boolean {
  const normalized = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return pathname === normalized || pathname.startsWith(`${normalized}/`);
}

/**
 * Phase 4 (app-subdomain migration cutover,
 * `docs/baseline/2026-09-14-app-subdomain-phase4/FINAL_ROUTE_OWNERSHIP_MATRIX.md`):
 * the three APP_ONLY *page* families that must permanently redirect
 * (GET/HEAD) or fail closed (everything else) when reached on the public
 * apex, now that the Phase 2/3 migration-compatibility window (both hosts
 * serving these pages) has ended. Deliberately page-only — it does not
 * include `/api/*`, which `classifyApiOwnership` below handles with finer
 * granularity (several `/api/*` families are `PUBLIC_ONLY` or
 * `SHARED_SAME_ORIGIN_SURFACE`, not `APP_ONLY`, so a blanket prefix rule
 * here would be wrong for them).
 *
 * `/app` is preserved as-is (no de-prefixing) per the Phase 4 directive's
 * explicit scope decision — the historical Phase 1 LEGACY_REDIRECT table
 * suggested de-prefixing to `app.crawlpact.com/**`; that was superseded by
 * the later Phase 2 implementation, which committed to
 * `app.crawlpact.com/app/**` as the real, tested, supported URL structure.
 * See `ORIGIN_AND_ROUTE_OWNERSHIP_MATRIX.md`'s supersession note.
 */
export const APP_ONLY_PAGE_PREFIXES = ["/sign-in", "/app", "/admin"];

export function isAppOnlyPagePath(pathname: string): boolean {
  return APP_ONLY_PAGE_PREFIXES.some((prefix) => matchesBoundary(pathname, prefix));
}

/**
 * Every `/api/**` route family's final ownership (Phase 4,
 * `ORIGIN_AND_ROUTE_OWNERSHIP_MATRIX.md` + this session's direct enumeration
 * of every file under `apps/web/src/pages/api/` — not copied from the
 * historical matrix without re-checking, since a matrix can drift from the
 * real route tree over time). Evaluated as an ordered list, most specific
 * rule first; the first match wins. Deliberately returns `"UNKNOWN"` — never
 * a default `SHARED_SAME_ORIGIN_SURFACE` guess — for any `/api/*` path this
 * list doesn't recognize (Phase 4 directive §4: "Do not default an unknown
 * API into shared"). `route-ownership.test.ts` asserts every real file under
 * `apps/web/src/pages/api/` classifies as something other than `"UNKNOWN"`,
 * so a new API route added later without updating this list fails CI rather
 * than silently falling through the host-boundary check unclassified.
 */
export type ApiOwnership =
  | "PUBLIC_ONLY"
  | "APP_ONLY"
  | "SHARED_SAME_ORIGIN_SURFACE"
  | "SERVER_TO_SERVER_PUBLIC"
  | "INTERNAL_ONLY"
  | "UNKNOWN";

type ApiRule = { test: (pathname: string) => boolean; ownership: ApiOwnership };

const API_OWNERSHIP_RULES: ApiRule[] = [
  // --- Exact matches and other most-specific rules first ---
  { test: (p) => p === "/api/audit", ownership: "PUBLIC_ONLY" }, // POST: create anonymous audit
  { test: (p) => p === "/api/analytics/track", ownership: "SHARED_SAME_ORIGIN_SURFACE" },
  { test: (p) => p === "/api/rum", ownership: "SHARED_SAME_ORIGIN_SURFACE" },
  { test: (p) => p === "/api/billing/webhook", ownership: "SERVER_TO_SERVER_PUBLIC" },
  // /api/agency-branding/logo (exact, upload — APP_ONLY) vs.
  // /api/agency-branding/logo/[...key] (PUBLIC_ONLY asset read) are two
  // distinct route files at different depths; the exact match must be
  // checked before the broader agency-branding prefix rule below.
  { test: (p) => p === "/api/agency-branding/logo", ownership: "APP_ONLY" },
  { test: (p) => matchesBoundary(p, "/api/agency-branding/logo"), ownership: "PUBLIC_ONLY" },
  // /api/audit/continuation/:id (consume, post-sign-in) is a distinct
  // top-level path from /api/audit/:id/** below — checked first.
  { test: (p) => matchesBoundary(p, "/api/audit/continuation"), ownership: "APP_ONLY" },
  // /api/audit/:auditId/share (dashboard action, owned-audit only) is the
  // one APP_ONLY exception inside the otherwise-PUBLIC_ONLY /api/audit/*
  // family — checked before the general audit-prefix rule below.
  { test: (p) => p.startsWith("/api/audit/") && p.endsWith("/share"), ownership: "APP_ONLY" },

  // --- General prefix rules ---
  { test: (p) => matchesBoundary(p, "/api/audit"), ownership: "PUBLIC_ONLY" },
  { test: (p) => matchesBoundary(p, "/api/agency-branding"), ownership: "APP_ONLY" },
  { test: (p) => matchesBoundary(p, "/api/auth"), ownership: "APP_ONLY" },
  { test: (p) => matchesBoundary(p, "/api/account"), ownership: "APP_ONLY" },
  { test: (p) => matchesBoundary(p, "/api/billing"), ownership: "APP_ONLY" },
  { test: (p) => matchesBoundary(p, "/api/domains"), ownership: "APP_ONLY" },
  { test: (p) => matchesBoundary(p, "/api/groups"), ownership: "APP_ONLY" },
  { test: (p) => matchesBoundary(p, "/api/workspace"), ownership: "APP_ONLY" },
  { test: (p) => matchesBoundary(p, "/api/notifications"), ownership: "APP_ONLY" },
  { test: (p) => matchesBoundary(p, "/api/app"), ownership: "APP_ONLY" }, // /api/app/pilot/feedback
  { test: (p) => matchesBoundary(p, "/api/admin"), ownership: "APP_ONLY" },
  { test: (p) => matchesBoundary(p, "/api/test-only"), ownership: "INTERNAL_ONLY" },
];

export function classifyApiOwnership(pathname: string): ApiOwnership {
  if (!pathname.startsWith("/api/")) return "UNKNOWN";
  for (const rule of API_OWNERSHIP_RULES) {
    if (rule.test(pathname)) return rule.ownership;
  }
  return "UNKNOWN";
}
