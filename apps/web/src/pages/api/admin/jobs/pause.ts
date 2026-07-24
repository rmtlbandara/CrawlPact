import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminAction } from "../../../../lib/auth/require-admin";
import { setSchedulerPaused } from "../../../../lib/admin/scheduler";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

const bodySchema = z.object({ paused: z.boolean(), reason: z.string().trim().min(3).max(500) });

/** POST /api/admin/jobs/pause — SRS §28.10 global scheduler pause/resume.
 * Only the monitoring sweep is affected: Paddle webhooks (a request-driven
 * route, not a scheduled job) and the public website are untouched. */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success)
      throw new ApiError("VALIDATION_FAILED", "A target state and reason are required.");

    await requireAdminAction(request, db, {
      action: parsed.data.paused ? "scheduler.pause" : "scheduler.resume",
      target: "scheduler",
      reason: parsed.data.reason,
      requestId,
      newState: { paused: parsed.data.paused },
    });

    await setSchedulerPaused(db, parsed.data.paused);
    return jsonResponse(ok({ paused: parsed.data.paused }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
