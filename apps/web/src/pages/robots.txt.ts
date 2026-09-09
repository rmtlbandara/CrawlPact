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

// Phase 2 of the app-subdomain migration (ADR-0010): app.crawlpact.com must
// never be crawled or carry a Sitemap line — it owns no public/indexable
// content at all (docs/baseline/2026-09-09-app-subdomain-phase1/
// ORIGIN_AND_ROUTE_OWNERSHIP_MATRIX.md). Textually identical to
// PREVIEW_ROBOTS_TXT today but kept as its own named export because they
// answer different questions ("this is a non-production environment" vs.
// "this host owns no public content") and could diverge later. This is
// defense-in-depth alongside noindex/authentication, never a substitute for
// either — a disallowed page can still be *linked to* and *not indexed* via
// noindex; robots.txt only asks well-behaved crawlers not to fetch it.
export const APP_ROBOTS_TXT = `User-agent: *
Disallow: /
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
