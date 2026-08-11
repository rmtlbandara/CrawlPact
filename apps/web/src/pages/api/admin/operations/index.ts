import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminSession } from "../../../../lib/auth/require-admin";
import { getOperationsSummary } from "../../../../lib/admin/operations";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/**
 * GET /api/admin/operations — Phase 14 Super Admin operations control
 * plane. Read-only, composes existing status/capacity/scheduler/alert
 * modules (see lib/admin/operations.ts's own doc comment) — a read, not an
 * action, so `requireAdminSession` only, matching `/api/admin/capacity` and
 * `/api/admin/health`'s own precedent for read-only operational views.
 */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const env = getEnv();
  const db = createDb(env.DB);
  try {
    await requireAdminSession(request, db);
    const summary = await getOperationsSummary(db, env.DB, env.AGENCY_LOGOS);
    return jsonResponse(ok(summary, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
