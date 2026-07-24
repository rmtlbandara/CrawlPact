import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { ApiError, adminActionRequestSchema, ok } from "@crawlpact/core";
import { createDb, schema } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminAction, requireAdminSession } from "../../../../../lib/auth/require-admin";
import { suspendUser } from "../../../../../lib/admin/users";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

/** POST /api/admin/users/:userId/suspend — SRS §28.3. Also revokes all active
 * sessions, so a suspended account is locked out immediately, not just at
 * next login. */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const userId = params.userId;
    if (!userId) throw new ApiError("VALIDATION_FAILED", "Missing user id.");

    const admin = await requireAdminSession(request, db);
    if (admin.user.id === userId) {
      throw new ApiError("ADMIN_ACTION_FORBIDDEN", "You cannot suspend your own account.");
    }

    const body = adminActionRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("ADMIN_REASON_REQUIRED", "A reason is required.");

    const [target] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    if (!target) throw new ApiError("NOT_FOUND", "This user does not exist.");

    await requireAdminAction(request, db, {
      action: "user.suspend",
      target: userId,
      reason: body.data.reason,
      requestId,
      previousState: { status: target.status },
      newState: { status: "suspended" },
    });

    await suspendUser(db, userId);
    return jsonResponse(ok({ userId, status: "suspended" }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
