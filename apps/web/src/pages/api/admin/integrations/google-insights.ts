import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminSession } from "../../../../lib/auth/require-admin";
import { getGoogleInsightsSnapshot } from "../../../../lib/admin/google-insights";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/**
 * GET /api/admin/integrations/google-insights — read-only connectivity
 * diagnostic for the Google Search Console / GA4 / CrUX integration. A
 * read, not an action — `requireAdminSession` only, matching
 * `/api/admin/health` and `/api/admin/capacity`'s own precedent for
 * read-only operational views (no audit-log entry). Never returns a
 * credential, token, or raw upstream payload — see
 * `../../../../lib/admin/google-insights.ts` for the sanitized per-service
 * status shape, and `../../../../lib/google/` for the provider clients
 * this composes.
 */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const env = getEnv();
  const db = createDb(env.DB);
  try {
    await requireAdminSession(request, db);
    const snapshot = await getGoogleInsightsSnapshot({
      serviceAccountJson: env.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON,
      ga4PropertyId: env.GOOGLE_GA4_PROPERTY_ID,
      searchConsoleSiteUrl: env.GOOGLE_SEARCH_CONSOLE_SITE_URL,
      cruxApiKey: env.CRUX_API_KEY,
      cruxOrigin: env.CRUX_ORIGIN,
    });
    return jsonResponse(ok(snapshot, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
