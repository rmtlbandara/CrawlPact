import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const prerender = true;

/**
 * Hand-written sitemap covering only reviewed public pages (SRS §30.3:
 * "XML sitemaps shall contain only reviewed public pages... Thin
 * programmatic pages shall not be generated."). Deliberately excludes
 * /audit/, /shared/*, /app, /sign-in, /admin, and /dev/* — see
 * public/robots.txt for the matching Disallow rules and middleware.ts for
 * the matching X-Robots-Tag header on those routes.
 */
const STATIC_ROUTES = [
  "/",
  "/about",
  "/contact",
  "/audit",
  "/sample-report",
  "/pricing",
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
  "/scanner",
  "/changelog",
  "/status",
  "/security",
  "/privacy",
  "/terms",
  "/acceptable-use",
  "/limitations",
];

type UrlEntry = { path: string; lastmod?: string };

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL("https://crawlpact.com");
  const crawlers = await getCollection("crawlers");
  const guides = await getCollection("guides");
  const verticals = await getCollection("verticals");
  const platforms = await getCollection("platforms");

  const entries: UrlEntry[] = [
    ...STATIC_ROUTES.map((path) => ({ path })),
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
