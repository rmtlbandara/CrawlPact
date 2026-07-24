import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminAction, requireAdminSession } from "../../../../lib/auth/require-admin";
import { createSystemNotice, listSystemNotices } from "../../../../lib/admin/notices";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(2000),
  severity: z.enum(["information", "warning", "critical"]),
  reason: z.string().trim().min(3).max(500),
});

/** GET /api/admin/notices — SRS §28.15. */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    return jsonResponse(ok(await listSystemNotices(db), requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

/** POST /api/admin/notices — creates a draft notice (unpublished). */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success)
      throw new ApiError("VALIDATION_FAILED", "A title, body, severity, and reason are required.");

    const admin = await requireAdminAction(request, db, {
      action: "notice.create",
      target: parsed.data.title,
      reason: parsed.data.reason,
      requestId,
    });

    const id = await createSystemNotice(db, {
      title: parsed.data.title,
      body: parsed.data.body,
      severity: parsed.data.severity,
      createdByUserId: admin.user.id,
    });

    return jsonResponse(ok({ id }, requestId), 201);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
