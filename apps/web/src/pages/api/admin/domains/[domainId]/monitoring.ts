import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminAction } from "../../../../../lib/auth/require-admin";
import { setDomainMonitoringState } from "../../../../../lib/admin/domains";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

const bodySchema = z.object({
  state: z.enum(["active", "paused"]),
  reason: z.string().trim().min(3).max(500),
});

/** POST /api/admin/domains/:domainId/monitoring — SRS §28.8 pause/resume. */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const domainId = params.domainId;
    if (!domainId) throw new ApiError("VALIDATION_FAILED", "Missing domain id.");

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success)
      throw new ApiError("VALIDATION_FAILED", "A target state and reason are required.");

    await requireAdminAction(request, db, {
      action:
        parsed.data.state === "paused" ? "domain.pause_monitoring" : "domain.resume_monitoring",
      target: domainId,
      reason: parsed.data.reason,
      requestId,
      newState: { monitoringState: parsed.data.state },
    });

    await setDomainMonitoringState(db, domainId, parsed.data.state);
    return jsonResponse(ok({ domainId, monitoringState: parsed.data.state }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
