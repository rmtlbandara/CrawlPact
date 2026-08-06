import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminSession } from "../../../../lib/auth/require-admin";
import { getComponentHealth, getSystemStatusSummary } from "../../../../lib/admin/health";
import { getStatusOverview } from "../../../../lib/status/public-status";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/**
 * GET /api/admin/health — SRS §28.10 internal health overview, extended by
 * the public-status-and-changelog trust correction to additively include
 * `statusOverview`: the same real signals side by side with what the
 * public `/status` page actually shows, so an administrator can see both
 * without the public page itself ever exposing internal detail. `summary`/
 * `components` are unchanged in shape — existing consumers of this route
 * are unaffected.
 */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    const [summary, components, statusOverview] = await Promise.all([
      getSystemStatusSummary(db),
      getComponentHealth(db),
      getStatusOverview(db),
    ]);
    return jsonResponse(ok({ summary, components, statusOverview }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
