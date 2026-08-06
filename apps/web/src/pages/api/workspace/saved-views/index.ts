import type { APIRoute } from "astro";
import { ApiError, createSavedViewRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireSession } from "../../../../lib/auth/require-session";
import { createSavedView, listSavedViews } from "../../../../lib/saved-views";
import { trackEvent } from "../../../../lib/analytics";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/** GET /api/workspace/saved-views — the caller's own saved portfolio-table views. */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);
    const views = await listSavedViews(db, user.id);
    return jsonResponse(ok(views, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

/** POST /api/workspace/saved-views — save the current portfolio-table filter/sort state. */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const body = await request.json().catch(() => {
      throw new ApiError("VALIDATION_FAILED", "Request body must be valid JSON.");
    });
    const parsed = createSavedViewRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Invalid saved view.", {
        issues: parsed.error.issues,
      });
    }

    const result = await createSavedView(db, user.id, parsed.data.name, parsed.data.filterState);
    if (!result.ok) {
      throw new ApiError("VALIDATION_FAILED", "You've reached the maximum number of saved views.");
    }

    await trackEvent(db, "saved_view_created", { userId: user.id });
    return jsonResponse(ok({ id: result.id }, requestId), 201);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
