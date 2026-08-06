import type { APIRoute } from "astro";
import { createDb } from "@crawlpact/database";
import { ok } from "@crawlpact/core";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { listPortfolioChangeFeed } from "../../../lib/portfolio";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

/** GET /api/workspace/changes — account-wide portfolio change feed, cursor-paginated (docs/product/PORTFOLIO_ATTENTION_MODEL.md). */
export const GET: APIRoute = async ({ request, url }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const groupId = url.searchParams.get("groupId");
    const changeOrigin = url.searchParams.get("changeOrigin") ?? undefined;
    const attentionLevel = url.searchParams.get("attentionLevel") ?? undefined;
    const since = url.searchParams.get("since") ?? undefined;
    const limitParam = url.searchParams.get("limit");
    const cursorObservedAt = url.searchParams.get("cursorObservedAt");
    const cursorId = url.searchParams.get("cursorId");

    const result = await listPortfolioChangeFeed(db, user.id, {
      groupId: groupId === null ? undefined : groupId === "none" ? null : groupId,
      changeOrigin,
      attentionLevel,
      since,
      limit: limitParam ? Number(limitParam) : undefined,
      cursor: cursorObservedAt && cursorId ? { observedAt: cursorObservedAt, id: cursorId } : null,
    });

    return jsonResponse(ok(result, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
