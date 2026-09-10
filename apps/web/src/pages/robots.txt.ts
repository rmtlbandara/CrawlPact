import type { APIRoute } from "astro";
import { getEnv } from "../lib/env";
import { classifyRequestOrigin } from "../lib/origin";

export const prerender = false;

/**
 * Phase 20: robots.txt must differ by environment (preview must disallow
 * everything — see PREVIEW_ROBOTS_TXT below), which requires reading
 * `PUBLIC_APP_ENV` at request time. This replaces the previous static
 * `apps/web/public/robots.txt` (deleted — a static file at this exact path
 * would shadow this endpoint under Cloudflare's default asset-first
 * routing, and would be served verbatim on preview with no way to vary its
 * content).
 */
export const PRODUCTION_ROBOTS_TXT = `User-agent: *
Allow: /

Disallow: /api/
Disallow: /audit/
Disallow: /app
Disallow: /sign-in
Disallow: /dev/

Sitemap: https://crawlpact.com/sitemap.xml
`;

// Phase 20, P0 (docs/baseline/2026-09-07-phase20/PREVIEW_SEARCH_ISOLATION.md):
// preview.crawlpact.com must never compete with production in Google
// Search. This is belt-and-suspenders alongside the
// `X-Robots-Tag: noindex` header `src/worker.ts`'s
// `fetchWithPreviewSearchIsolation` stamps on every preview response —
// disallowing crawl entirely here stops a compliant crawler from ever
// fetching a preview page in the first place. No `Sitemap:` line: nothing
// on preview should ever be submitted for indexing.
export const PREVIEW_ROBOTS_TXT = `User-agent: *
Disallow: /
`;

// Phase 2 of the app-subdomain migration (ADR-0010) originally blocked
// app.crawlpact.com entirely (`Disallow: /`) — reverted 2026-09-10 (owner
// decision, docs/baseline/2026-09-09-app-subdomain-phase3/): Google's own
// guidance is that a page blocked by robots.txt never has its `noindex`
// signal seen at all ("If a page is blocked by a robots.txt file... the
// crawler will never see the noindex rule, and the page can still appear
// in search results" — Google Search Central), which made a blanket
// disallow here actively counterproductive as the *primary* mechanism for
// keeping this host out of Search, exactly backwards from the intent. That
// same blanket disallow turned out to have a second, unrelated cost found
// the same day: Paddle's own automated checkout-domain review reported it
// "could not reach" app.crawlpact.com at all — a compliant, robots.txt-
// respecting reviewer requesting `/` got turned away before ever seeing
// the (now also newly-public, see `worker.ts`) `/app-shell` landing
// content it needed to review.
//
// `/` (which `worker.ts` serves as the public `/app-shell` landing page for
// any visitor with no session cookie) and `/sign-in` are the only two real,
// content-bearing HTML surfaces this host serves an unauthenticated
// visitor. `/sign-in` needs no explicit `Allow` rule — it doesn't match any
// `Disallow` prefix below, and the robots.txt spec's default for a path
// matching no rule at all is "allowed" — but `Allow: /` is still written
// out explicitly rather than relying on that implicit default: this file
// exists specifically because Paddle's own checkout-domain reviewer (an
// unknown, non-search-engine robots.txt implementation, unlike Googlebot)
// reported it "could not reach" this host, so the one thing this file
// cannot afford is depending on every possible parser correctly
// implementing the *unwritten* default rule.
//
// Being crawlable is what lets Googlebot and Paddle's reviewer actually
// observe the `noindex` directives that already exist independently of
// this file and are unaffected by this change: `middleware.ts`'s
// host-agnostic `X-Robots-Tag: noindex, nofollow, noarchive` (applied to
// both `/` — via its `/app`/`/app-shell` rewrite target — and `/sign-in`,
// alongside every other non-indexable path prefix) and `AuthLayout.astro`'s
// `<meta name="robots" content="noindex, nofollow">` (both pages use
// `AuthLayout`). `noindex` — not this file — is the actual deindexing
// mechanism; robots.txt's only remaining job here is to not defeat it.
//
// Everything else this host serves stays disallowed — real application
// route prefixes only, not invented ones: `/app` (the dashboard; also
// covers `/app-shell` as an incidental side effect of the shared `/app`
// prefix, harmless since the identical content is already reachable and
// crawlable at `/`), `/admin`, `/api/`, `/audit/`, `/shared/`, `/dev/`.
// robots.txt is crawl hygiene here, never the security boundary — every one
// of these stays genuinely protected by this Worker's own authentication/
// authorization checks (or, for `/audit/`/`/shared/`, by the app-host
// public-ownership redirect) regardless of what any crawler chooses to
// respect.
//
// Deliberately still no `Sitemap:` line — nothing on this host should ever
// be submitted for indexing, `/`/`/sign-in` included; crawlable-enough for
// their own noindex to be observed is not the same as indexable.
export const APP_ROBOTS_TXT = `User-agent: *
Allow: /

Disallow: /app
Disallow: /admin
Disallow: /api/
Disallow: /audit/
Disallow: /shared/
Disallow: /dev/
`;

export const GET: APIRoute = ({ request }) => {
  const env = getEnv();
  const body =
    env.PUBLIC_APP_ENV === "preview"
      ? PREVIEW_ROBOTS_TXT
      : classifyRequestOrigin(request) === "app"
        ? APP_ROBOTS_TXT
        : PRODUCTION_ROBOTS_TXT;
  return new Response(body, { headers: { "Content-Type": "text/plain" } });
};
