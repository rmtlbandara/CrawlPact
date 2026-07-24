import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminAction } from "../../../../../lib/auth/require-admin";
import { addInternalNote } from "../../../../../lib/admin/users";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

const addNoteSchema = z.object({ note: z.string().trim().min(3).max(2000) });

/** POST /api/admin/users/:userId/notes — SRS §28.3. The note text itself
 * doubles as the audited "reason" — a note IS its own justification. */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const userId = params.userId;
    if (!userId) throw new ApiError("VALIDATION_FAILED", "Missing user id.");

    const parsed = addNoteSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success)
      throw new ApiError("VALIDATION_FAILED", "A note of at least 3 characters is required.");

    const admin = await requireAdminAction(request, db, {
      action: "user.add_note",
      target: userId,
      reason: parsed.data.note,
      requestId,
    });

    await addInternalNote(db, { userId, authorUserId: admin.user.id, note: parsed.data.note });
    return jsonResponse(ok({ userId, added: true }, requestId), 201);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
