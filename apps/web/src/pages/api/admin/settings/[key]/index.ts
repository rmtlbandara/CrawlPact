import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminAction } from "../../../../../lib/auth/require-admin";
import { updateRuntimeConfig } from "../../../../../lib/admin/runtime-config";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

const bodySchema = z.object({
  value: z.string().min(1).max(200),
  reason: z.string().trim().min(3).max(500),
});

/** POST /api/admin/settings/:key — SRS §28.16. Only pre-existing keys can be
 * updated (see lib/admin/runtime-config.ts for why that structurally rules
 * out both secret editing and arbitrary config injection). */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const key = params.key;
    if (!key) throw new ApiError("VALIDATION_FAILED", "Missing configuration key.");

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success)
      throw new ApiError("VALIDATION_FAILED", "A value and reason are required.");

    const admin = await requireAdminAction(request, db, {
      action: "runtime_config.update",
      target: key,
      reason: parsed.data.reason,
      requestId,
      newState: { value: parsed.data.value },
    });

    const result = await updateRuntimeConfig(db, {
      key,
      value: parsed.data.value,
      updatedByUserId: admin.user.id,
    });
    if (!result.ok) throw new ApiError("VALIDATION_FAILED", result.reason);

    return jsonResponse(ok({ key, value: parsed.data.value }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
