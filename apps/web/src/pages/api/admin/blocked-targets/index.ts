import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminAction, requireAdminSession } from "../../../../lib/auth/require-admin";
import { blockTarget, listBlockedTargets } from "../../../../lib/blocked-targets";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

const blockSchema = z.object({
  targetPattern: z.string().trim().min(3).max(300),
  reason: z.string().trim().min(3).max(500),
});

/** GET /api/admin/blocked-targets — SRS §28.8/§28.14. */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    const rows = await listBlockedTargets(db);
    return jsonResponse(ok(rows, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

/** POST /api/admin/blocked-targets — adds a pattern to the scanner's blocklist. */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const parsed = blockSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success)
      throw new ApiError("VALIDATION_FAILED", "A target pattern and reason are required.");

    const admin = await requireAdminAction(request, db, {
      action: "target.block",
      target: parsed.data.targetPattern,
      reason: parsed.data.reason,
      requestId,
    });

    const id = await blockTarget(db, {
      targetPattern: parsed.data.targetPattern,
      reason: parsed.data.reason,
      blockedByUserId: admin.user.id,
    });

    return jsonResponse(ok({ id }, requestId), 201);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
