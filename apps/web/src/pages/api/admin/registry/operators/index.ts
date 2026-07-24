import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminAction, requireAdminSession } from "../../../../../lib/auth/require-admin";
import { createOperator, listOperators } from "../../../../../lib/admin/registry";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  websiteUrl: z.string().url().optional(),
  reason: z.string().trim().min(3).max(500),
});

/** GET /api/admin/registry/operators — SRS §28.11. */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    return jsonResponse(ok(await listOperators(db), requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

/** POST /api/admin/registry/operators — create a crawler operator. */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ApiError("VALIDATION_FAILED", "A name and reason are required.");

    await requireAdminAction(request, db, {
      action: "registry.operator.create",
      target: parsed.data.name,
      reason: parsed.data.reason,
      requestId,
    });

    const id = await createOperator(db, {
      name: parsed.data.name,
      websiteUrl: parsed.data.websiteUrl,
    });
    return jsonResponse(ok({ id }, requestId), 201);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
