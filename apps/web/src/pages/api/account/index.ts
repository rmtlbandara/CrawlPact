import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { updateDisplayName } from "../../../lib/account";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

/** GET /api/account — the caller's own profile. */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);
    return jsonResponse(
      ok(
        {
          id: user.id,
          displayName: user.displayName,
          planId: user.planId,
          status: user.status,
          createdAt: user.createdAt,
        },
        requestId,
      ),
      200,
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

const updateAccountRequestSchema = z.object({ displayName: z.string().trim().min(1).max(80) });

/** PATCH /api/account — update the account display name. */
export const PATCH: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const body = await request.json().catch(() => {
      throw new ApiError("VALIDATION_FAILED", "Request body must be valid JSON.");
    });
    const parsed = updateAccountRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Enter a display name.", {
        issues: parsed.error.issues,
      });
    }

    await updateDisplayName(db, user.id, parsed.data.displayName);
    return jsonResponse(ok({ updated: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
