import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { requireAdminSession } from "../../../lib/auth/require-admin";
import {
  getProductAnalyticsSnapshot,
  type DateRangeDays,
} from "../../../lib/admin/product-analytics";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

const ALLOWED_RANGES: DateRangeDays[] = [7, 30, 90, 365];

/**
 * GET /api/admin/analytics — Phase 13 Super Admin product-measurement
 * dashboard. Read-only, bounded (never loads full event history — every
 * query in product-analytics.ts filters by a date range or is a bounded
 * aggregate). A read, not an action — `requireAdminSession` only, matching
 * `/api/admin/capacity`'s own precedent for read-only operational views.
 */
export const GET: APIRoute = async ({ request, url }) => {
  const requestId = crypto.randomUUID();
  const env = getEnv();
  const db = createDb(env.DB);
  try {
    await requireAdminSession(request, db);
    const rangeParam = Number(url.searchParams.get("rangeDays") ?? "30");
    const rangeDays = (
      ALLOWED_RANGES.includes(rangeParam as DateRangeDays) ? rangeParam : 30
    ) as DateRangeDays;
    const snapshot = await getProductAnalyticsSnapshot(db, rangeDays);
    return jsonResponse(ok(snapshot, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
