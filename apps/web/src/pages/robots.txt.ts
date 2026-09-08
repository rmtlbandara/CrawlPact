import type { APIRoute } from "astro";
import { getEnv } from "../lib/env";

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

export const GET: APIRoute = () => {
  const body = getEnv().PUBLIC_APP_ENV === "preview" ? PREVIEW_ROBOTS_TXT : PRODUCTION_ROBOTS_TXT;
  return new Response(body, { headers: { "Content-Type": "text/plain" } });
};
