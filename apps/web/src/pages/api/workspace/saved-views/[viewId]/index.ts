import type { APIRoute } from "astro";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireSession } from "../../../../../lib/auth/require-session";
import { deleteSavedView } from "../../../../../lib/saved-views";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

/** DELETE /api/workspace/saved-views/:viewId */
export const DELETE: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const viewId = params.viewId;
    if (!viewId) throw new ApiError("VALIDATION_FAILED", "Missing view id.");

    const deleted = await deleteSavedView(db, user.id, viewId);
    if (!deleted) throw new ApiError("NOT_FOUND", "This saved view does not exist.");

    return jsonResponse(ok({ deleted: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
