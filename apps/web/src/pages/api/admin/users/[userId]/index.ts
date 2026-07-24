import type { APIRoute } from "astro";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminSession } from "../../../../../lib/auth/require-admin";
import { getUserDetail } from "../../../../../lib/admin/users";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

/** GET /api/admin/users/:userId — SRS §28.3 user detail. Never returns recovery
 * codes, session tokens, passkey private material, or Paddle secrets. */
export const GET: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    const userId = params.userId;
    if (!userId) throw new ApiError("VALIDATION_FAILED", "Missing user id.");

    const detail = await getUserDetail(db, userId);
    if (!detail) throw new ApiError("NOT_FOUND", "This user does not exist.");

    return jsonResponse(ok(detail, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
