import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminSession } from "../../../../lib/auth/require-admin";
import { getFindingAnalytics } from "../../../../lib/admin/findings";
import { resolveDateRange } from "../../../../lib/admin/date-range";
import type { DateRangePreset } from "../../../../lib/admin/date-range";
import { DATE_RANGE_LABELS } from "../../../../lib/admin/date-range";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/** GET /api/admin/findings — SRS §28.12 finding analytics. */
export const GET: APIRoute = async ({ request, url }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    const presetParam = (url.searchParams.get("range") ?? "30d") as DateRangePreset;
    const preset: DateRangePreset = presetParam in DATE_RANGE_LABELS ? presetParam : "30d";
    const range = resolveDateRange(preset === "custom" ? "30d" : preset);
    const analytics = await getFindingAnalytics(db, range.from);
    return jsonResponse(ok(analytics, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
