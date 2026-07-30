import type { APIRoute } from "astro";
import { getEnv } from "../../../../lib/env";

export const prerender = false;

/**
 * GET /api/agency-branding/logo/:userId/:filename — deliberately public,
 * unauthenticated: shared reports (SRS §23) are viewed by third parties
 * with no CrawlPact account, so their agency-branding logo must be too.
 * Safe to serve any key in this bucket unauthenticated because the bucket
 * (`AGENCY_LOGOS`) holds nothing but what `../logo.ts`'s upload route ever
 * wrote — an arbitrary-key read can only ever return a legitimately
 * uploaded logo, never any other CrawlPact data. Cached at the edge since
 * objects are immutable (a new upload always gets a fresh random key).
 */
export const GET: APIRoute = async ({ params }) => {
  const key = params.key;
  if (!key) return new Response(null, { status: 404 });

  const object = await getEnv().AGENCY_LOGOS.get(key);
  if (!object) return new Response(null, { status: 404 });

  return new Response(object.body, {
    status: 200,
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
