import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { ALL_STATIC_INDEXABLE_ROUTES, canonicalStaticPath } from "../lib/route-registry";

export const prerender = true;

/**
 * Hand-written sitemap covering only reviewed public pages (SRS §30.3:
 * "XML sitemaps shall contain only reviewed public pages... Thin
 * programmatic pages shall not be generated."). Deliberately excludes
 * /audit/, /shared/*, /app, /sign-in, /admin, and /dev/* — see
 * robots.txt.ts for the matching Disallow rules and middleware.ts for the
 * matching X-Robots-Tag header on those routes.
 *
 * Route list (and the canonical trailing slash appended below) comes from
 * `lib/route-registry.ts` — the same source `middleware.ts` and
 * `public/_redirects` read (Phase 20 canonical URL contract) — so this file
 * cannot silently list a URL that doesn't match what the site actually
 * serves as canonical.
 *
 * Phase 16: /research and /research/[slug] are deliberately excluded here —
 * this file is prerender=true (build-time, no D1 binding available), so it
 * cannot reflect which publications are actually published, and nothing is
 * published yet. Revisit once a first publication ships; see
 * docs/product/PHASE_16_OBSERVATORY_ROUTE_ARCHITECTURE.md.
 */
const STATIC_ROUTES = ALL_STATIC_INDEXABLE_ROUTES;

type UrlEntry = { path: string; lastmod?: string };

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL("https://crawlpact.com");
  const crawlers = await getCollection("crawlers");
  const guides = await getCollection("guides");
  const verticals = await getCollection("verticals");
  const platforms = await getCollection("platforms");

  const entries: UrlEntry[] = [
    ...STATIC_ROUTES.map((path) => ({ path: canonicalStaticPath(path) })),
    ...crawlers.map((crawler) => ({
      path: `/crawlers/${crawler.id}/`,
      lastmod: crawler.data.lastVerified,
    })),
    ...guides.map((guide) => ({
      path: `/guides/${guide.id}/`,
      lastmod: guide.data.updatedDate ?? guide.data.publishedDate,
    })),
    // Phase 7 — see docs/seo/SITEMAP_AND_INDEXABILITY_POLICY.md.
    ...verticals.map((vertical) => ({
      path: `/for/${vertical.id}/`,
      lastmod: vertical.data.updatedDate ?? vertical.data.publishedDate,
    })),
    ...platforms.map((platform) => ({
      path: `/platforms/${platform.id}/`,
      lastmod: platform.data.updatedDate ?? platform.data.publishedDate,
    })),
  ];

  const urlEntries = entries
    .map((entry) => {
      const loc = `<loc>${new URL(entry.path, base).toString()}</loc>`;
      const lastmod = entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : "";
      return `  <url>${loc}${lastmod}</url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>`;

  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
};
