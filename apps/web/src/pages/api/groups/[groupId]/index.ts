import type { APIRoute } from "astro";
import { ApiError, ok, updateGroupRequestSchema } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireSession } from "../../../../lib/auth/require-session";
import { deleteGroupIfEmpty, renameGroup } from "../../../../lib/groups";
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

    const renamed = await renameGroup(db, user.id, groupId, parsed.data.name);
    if (!renamed) throw new ApiError("NOT_FOUND", "This group does not exist.");

    return jsonResponse(ok({ renamed: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

/** DELETE /api/groups/:groupId — only allowed when the group has no domains left in it. */
export const DELETE: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const groupId = params.groupId;
    if (!groupId) throw new ApiError("VALIDATION_FAILED", "Missing group id.");

    const result = await deleteGroupIfEmpty(db, user.id, groupId);
    if (!result.ok) {
      throw new ApiError(
        result.reason === "not_found" ? "NOT_FOUND" : "GROUP_NOT_EMPTY",
        result.reason === "not_found"
          ? "This group does not exist."
          : "Move or remove the domains in this group before deleting it.",
      );
    }

    return jsonResponse(ok({ deleted: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
