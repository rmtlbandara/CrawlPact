import type { APIRoute } from "astro";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireSession } from "../../../../lib/auth/require-session";
import { getOwnedDomain } from "../../../../lib/domains";
import { getPlan } from "../../../../lib/plan";
import {
  listScanHistory,
  retentionBoundaryFor,
  type ScanHistoryFilter,
} from "../../../../lib/scan-history";
import { trackEvent } from "../../../../lib/analytics";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

const VALID_FILTERS = new Set<ScanHistoryFilter>([
  "all",
  "manual",
  "scheduled",
  "successful",
  "partial",
  "failed",
  "change_detected",
  "no_material_change",
]);

/**
 * GET /api/domains/:domainId/scans — bounded, filterable, paginated scan
 * history (Phase 8), replacing the previous unpaginated 20-row inline list.
 */
export const GET: APIRoute = async ({ request, params, url }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);
    const domainId = params.domainId;
    if (!domainId) throw new ApiError("VALIDATION_FAILED", "Missing domain id.");

    const domain = await getOwnedDomain(db, user.id, domainId);
    if (!domain) throw new ApiError("NOT_FOUND", "This domain does not exist.");

    const filterParam = url.searchParams.get("filter");
    const filter: ScanHistoryFilter =
      filterParam && VALID_FILTERS.has(filterParam as ScanHistoryFilter)
        ? (filterParam as ScanHistoryFilter)
        : "all";

    const cursorStartedAt = url.searchParams.get("cursorStartedAt");
    const cursorScanId = url.searchParams.get("cursorScanId");

    const { scans, nextCursor } = await listScanHistory(db, domainId, {
      filter,
      cursor:
        cursorStartedAt && cursorScanId
          ? { startedAt: cursorStartedAt, scanId: cursorScanId }
          : null,
    });

    const plan = await getPlan(db, user.planId);
    const retentionBoundary = await retentionBoundaryFor(db, domainId, plan.historyRetentionDays);

    await trackEvent(db, "domain_scan_history_viewed", { userId: user.id, properties: { filter } });

    return jsonResponse(ok({ scans, nextCursor, retentionBoundary }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
