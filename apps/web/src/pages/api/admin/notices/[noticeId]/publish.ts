import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminAction } from "../../../../../lib/auth/require-admin";
import { setNoticePublished } from "../../../../../lib/admin/notices";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

const bodySchema = z.object({ published: z.boolean(), reason: z.string().trim().min(3).max(500) });

/** POST /api/admin/notices/:noticeId/publish — SRS §28.15. */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const noticeId = params.noticeId;
    if (!noticeId) throw new ApiError("VALIDATION_FAILED", "Missing notice id.");

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success)
      throw new ApiError("VALIDATION_FAILED", "A target state and reason are required.");

    await requireAdminAction(request, db, {
      action: parsed.data.published ? "notice.publish" : "notice.unpublish",
      target: noticeId,
      reason: parsed.data.reason,
      requestId,
    });

    await setNoticePublished(db, noticeId, parsed.data.published);
    return jsonResponse(ok({ noticeId, published: parsed.data.published }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
