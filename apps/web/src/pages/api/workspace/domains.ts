import type { APIRoute } from "astro";
import { createDb } from "@crawlpact/database";
import { ok } from "@crawlpact/core";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { listPortfolioDomains } from "../../../lib/portfolio";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

const VALID_SORTS = new Set(["domain", "last_scan", "next_scan", "recent_change", "attention"]);

/** GET /api/workspace/domains — server-side paginated portfolio table (docs/product/DOMAIN_GROUP_MODEL.md §5). */
export const GET: APIRoute = async ({ request, url }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const groupId = url.searchParams.get("groupId");
    const attentionOnly = url.searchParams.get("attentionOnly") === "1";
    const monitoringStateParam = url.searchParams.get("monitoringState");
    const changeOrigin = url.searchParams.get("changeOrigin") ?? undefined;
    const scanStateParam = url.searchParams.get("scanState");
    const search = url.searchParams.get("search") ?? undefined;
    const sortParam = url.searchParams.get("sort");
    const cursorParam = url.searchParams.get("cursor");
    const limitParam = url.searchParams.get("limit");

    const result = await listPortfolioDomains(db, user.id, {
      groupId: groupId === null ? undefined : groupId === "none" ? null : groupId,
      attentionOnly,
      monitoringState:
        monitoringStateParam === "active" || monitoringStateParam === "paused"
          ? monitoringStateParam
          : undefined,
      changeOrigin,
      scanState:
        scanStateParam === "failed" || scanStateParam === "incomplete" ? scanStateParam : undefined,
      search,
      sort: sortParam && VALID_SORTS.has(sortParam) ? (sortParam as never) : undefined,
      cursor: cursorParam ? Number(cursorParam) : undefined,
      limit: limitParam ? Number(limitParam) : undefined,
    });

    return jsonResponse(ok(result, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
