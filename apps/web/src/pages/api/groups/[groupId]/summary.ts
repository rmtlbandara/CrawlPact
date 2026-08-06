import type { APIRoute } from "astro";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireSession } from "../../../../lib/auth/require-session";
import { getOwnedGroup } from "../../../../lib/groups";
import { getGroupSummary } from "../../../../lib/portfolio";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/** GET /api/groups/:groupId/summary — group-level overview (docs/product/DOMAIN_GROUP_MODEL.md §4). */
export const GET: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const groupId = params.groupId;
    if (!groupId) throw new ApiError("VALIDATION_FAILED", "Missing group id.");

    const group = await getOwnedGroup(db, user.id, groupId);
    if (!group) throw new ApiError("NOT_FOUND", "This group does not exist.");

    const summary = await getGroupSummary(db, user.id, groupId);
    return jsonResponse(
      ok(
        { groupId: group.id, name: group.name, description: group.description, summary },
        requestId,
      ),
      200,
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
