import type { APIRoute } from "astro";
import { ApiError, deleteGroupRequestSchema, ok, updateGroupRequestSchema } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireSession } from "../../../../lib/auth/require-session";
import { deleteGroupWithReassignment, renameGroup } from "../../../../lib/groups";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/** PATCH /api/groups/:groupId — rename a group the caller owns. */
export const PATCH: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const groupId = params.groupId;
    if (!groupId) throw new ApiError("VALIDATION_FAILED", "Missing group id.");

    const body = await request.json().catch(() => {
      throw new ApiError("VALIDATION_FAILED", "Request body must be valid JSON.");
    });
    const parsed = updateGroupRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Enter a group name.", {
        issues: parsed.error.issues,
      });
    }

    const renamed = await renameGroup(
      db,
      user.id,
      groupId,
      parsed.data.name,
      parsed.data.description,
    );
    if (!renamed) throw new ApiError("NOT_FOUND", "This group does not exist.");

    return jsonResponse(ok({ renamed: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

/**
 * DELETE /api/groups/:groupId — deletes the group. Any member domains move
 * to the given `destinationGroupId`, or to Ungrouped when omitted/null
 * (docs/product/DOMAIN_GROUP_MODEL.md §2) — domain history and monitoring
 * are never affected.
 */
export const DELETE: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const groupId = params.groupId;
    if (!groupId) throw new ApiError("VALIDATION_FAILED", "Missing group id.");

    const rawBody = await request.text();
    const parsed = deleteGroupRequestSchema.safeParse(rawBody ? JSON.parse(rawBody) : {});
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Invalid request body.", {
        issues: parsed.error.issues,
      });
    }

    const result = await deleteGroupWithReassignment(
      db,
      user.id,
      groupId,
      parsed.data.destinationGroupId ?? null,
    );
    if (!result.ok) {
      throw new ApiError(
        result.reason === "not_found" ? "NOT_FOUND" : "VALIDATION_FAILED",
        result.reason === "not_found"
          ? "This group does not exist."
          : "The destination group is not valid.",
      );
    }

    return jsonResponse(ok({ deleted: true, movedCount: result.movedCount }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
