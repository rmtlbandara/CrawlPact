import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { requireAdminSession } from "../../../lib/auth/require-admin";
import { getDashboardMetrics } from "../../../lib/admin/dashboard";
import { resolveDateRange } from "../../../lib/admin/date-range";
import type { DateRangePreset } from "../../../lib/admin/date-range";
import { DATE_RANGE_LABELS } from "../../../lib/admin/date-range";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

/** GET /api/admin/dashboard — SRS §28.2. JSON counterpart to /admin's SSR page,
 * for programmatic/future-client use; both call the same lib/admin/dashboard.ts. */
export const GET: APIRoute = async ({ request, url }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);

    const presetParam = (url.searchParams.get("range") ?? "30d") as DateRangePreset;
    const preset: DateRangePreset = presetParam in DATE_RANGE_LABELS ? presetParam : "30d";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const range =
      preset === "custom" && from && to
        ? resolveDateRange("custom", { from, to })
        : resolveDateRange(preset === "custom" ? "30d" : preset);

    const metrics = await getDashboardMetrics(db, range);
    return jsonResponse(ok(metrics, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
