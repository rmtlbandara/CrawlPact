import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { requireAdminSession } from "../../../lib/auth/require-admin";
import { getOperationalCapacitySnapshot } from "../../../lib/admin/capacity";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

/**
 * GET /api/admin/capacity — Phase 11, Stage 11H. Read-only operational
 * capacity view (D1 size, R2 object count, scan volume/cost, monitoring
 * backlog, retention job health) — see
 * `docs/operations/PHASE_11_OPERATIONAL_CAPACITY_VIEW.md` for the full
 * metric list, including which ones are deliberately reported as `null`
 * because no in-Worker query can answer them honestly (Cloudflare account
 * plan, Worker CPU-limit error counts, build bundle size). A read, not an
 * action — `requireAdminSession` only, no audit-log entry, matching
 * `/api/admin/health` and `/api/admin/jobs`'s own precedent for read-only
 * operational views.
 */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const env = getEnv();
  const db = createDb(env.DB);
  try {
    await requireAdminSession(request, db);
    const snapshot = await getOperationalCapacitySnapshot(db, env.DB, env.AGENCY_LOGOS);
    return jsonResponse(ok(snapshot, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
