import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { ApiError, adminActionRequestSchema, ok } from "@crawlpact/core";
import { createDb, schema } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminAction } from "../../../../../lib/auth/require-admin";
import { requestAccountDeletion } from "../../../../../lib/account";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

/** POST /api/admin/users/:userId/begin-deletion — SRS §28.3. Same cancellable
 * 30-day grace period as self-service deletion (lib/account.ts). */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const userId = params.userId;
    if (!userId) throw new ApiError("VALIDATION_FAILED", "Missing user id.");

    const body = adminActionRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("ADMIN_REASON_REQUIRED", "A reason is required.");

    const [target] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    if (!target) throw new ApiError("NOT_FOUND", "This user does not exist.");

    await requireAdminAction(request, db, {
      action: "user.begin_deletion",
      target: userId,
      reason: body.data.reason,
      requestId,
      previousState: { status: target.status },
      newState: { status: "pending_deletion" },
    });

    await requestAccountDeletion(db, userId);
    return jsonResponse(ok({ userId, status: "pending_deletion" }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
