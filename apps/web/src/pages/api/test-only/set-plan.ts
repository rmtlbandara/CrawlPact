import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { ApiError, ok } from "@crawlpact/core";
import { createDb, schema } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { assertTestOnlyAccess } from "../../../lib/test-only";
import { requireSession } from "../../../lib/auth/require-session";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

const VALID_PLANS = new Set(["free", "solo", "pro", "agency"]);

/**
 * e2e-only (Phase 9): sets the CALLING session's own plan, so Playwright
 * journeys can reach Pro/Agency-gated UI (domain groups, CSV import/export,
 * agency branding) without a real Paddle checkout — mirrors
 * grant-super-admin.ts's self-service, calling-session-only pattern.
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    assertTestOnlyAccess(request);
    const db = createDb(getEnv().DB);
    const ctx = await requireSession(request, db);

    const body = await request.json().catch(() => null);
    const planId = (body as { planId?: string } | null)?.planId;
    if (!planId || !VALID_PLANS.has(planId)) {
      throw new ApiError("VALIDATION_FAILED", "planId must be one of free, solo, pro, agency.");
    }

    await db
      .update(schema.users)
      .set({ planId: planId as never })
      .where(eq(schema.users.id, ctx.user.id));

    return jsonResponse(ok({ userId: ctx.user.id, planId }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
