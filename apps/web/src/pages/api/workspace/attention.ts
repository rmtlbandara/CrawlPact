import type { APIRoute } from "astro";
import { createDb } from "@crawlpact/database";
import { ok } from "@crawlpact/core";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { listAttentionQueue } from "../../../lib/portfolio";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

/** GET /api/workspace/attention — bounded, paginated attention queue (docs/product/PORTFOLIO_ATTENTION_MODEL.md). */
export const GET: APIRoute = async ({ request, url }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const groupId = url.searchParams.get("groupId");
    const changeOrigin = url.searchParams.get("changeOrigin") ?? undefined;
    const monitoringStateParam = url.searchParams.get("monitoringState");
    const cursorParam = url.searchParams.get("cursor");
    const limitParam = url.searchParams.get("limit");

    const result = await listAttentionQueue(db, user.id, {
      groupId: groupId === null ? undefined : groupId === "none" ? null : groupId,
      changeOrigin,
      monitoringState:
        monitoringStateParam === "active" || monitoringStateParam === "paused"
          ? monitoringStateParam
          : undefined,
      cursor: cursorParam ? Number(cursorParam) : undefined,
      limit: limitParam ? Number(limitParam) : undefined,
    });

    return jsonResponse(ok(result, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
