import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminSession } from "../../../../lib/auth/require-admin";
import {
  getFrequentlyScannedHosts,
  getHighVolumeAccounts,
  listSecurityEvents,
} from "../../../../lib/admin/security";
import { resolveDateRange } from "../../../../lib/admin/date-range";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/** GET /api/admin/security — SRS §28.14 security dashboard. */
export const GET: APIRoute = async ({ request, url }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    const range = resolveDateRange("30d");
    const [events, highVolumeAccounts, frequentlyScannedHosts] = await Promise.all([
      listSecurityEvents(db, {
        eventType: url.searchParams.get("eventType") ?? undefined,
        unresolvedOnly: url.searchParams.get("unresolvedOnly") === "true",
      }),
      getHighVolumeAccounts(db, range.from),
      getFrequentlyScannedHosts(db, range.from),
    ]);
    return jsonResponse(ok({ events, highVolumeAccounts, frequentlyScannedHosts }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
