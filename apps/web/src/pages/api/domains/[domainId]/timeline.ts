import type { APIRoute } from "astro";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireSession } from "../../../../lib/auth/require-session";
import { getOwnedDomain } from "../../../../lib/domains";
import { listDomainChangeEvents } from "../../../../lib/domain-timeline";
import { getPlan } from "../../../../lib/plan";
import { retentionBoundaryFor } from "../../../../lib/scan-history";
import { trackEvent } from "../../../../lib/analytics";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/**
 * GET /api/domains/:domainId/timeline — paginated policy-change timeline
 * (Phase 8). Ownership is checked before any timeline row is read, so an
 * unowned/nonexistent domain ID returns the same 404 either way — no
 * existence oracle. Per-account history: relies on the global middleware's
 * `private, no-store` default (apps/web/src/middleware.ts) since this route
 * never sets its own Cache-Control.
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

    const cursorObservedAt = url.searchParams.get("cursorObservedAt");
    const cursorId = url.searchParams.get("cursorId");
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    const { events, nextCursor } = await listDomainChangeEvents(db, domainId, {
      limit: limit && Number.isFinite(limit) ? limit : undefined,
      cursor: cursorObservedAt && cursorId ? { observedAt: cursorObservedAt, id: cursorId } : null,
    });

    const plan = await getPlan(db, user.planId);
    const retentionBoundary = await retentionBoundaryFor(db, domainId, plan.historyRetentionDays);

    await trackEvent(db, "domain_timeline_viewed", { userId: user.id });

    return jsonResponse(
      ok(
        {
          events: events.map((e) => ({
            id: e.id,
            eventType: e.eventType,
            changeOrigin: e.changeOrigin,
            attentionLevel: e.attentionLevel,
            observedAt: e.observedAt,
            previousScanId: e.previousScanId,
            currentScanId: e.currentScanId,
            affectedPurposes: JSON.parse(e.affectedPurposesJson) as string[],
            findingCounts: JSON.parse(e.findingCountsJson) as Record<string, number>,
            summary: e.summary,
            completeness: e.completeness,
          })),
          nextCursor,
          retentionBoundary,
        },
        requestId,
      ),
      200,
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
