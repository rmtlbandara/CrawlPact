import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../../lib/env";
import { requireAdminAction } from "../../../../../../lib/auth/require-admin";
import { acknowledgeOperationalAlert } from "../../../../../../lib/admin/operational-alerts";
import { jsonErrorResponse, jsonResponse } from "../../../../../../lib/json-response";

export const prerender = false;

const bodySchema = z.object({ reason: z.string().trim().min(3).max(500) });

/**
 * POST /api/admin/operations/alerts/:alertId/acknowledge — Phase 14 §28.
 * Records that an operator has seen an active alert. Purely informational
 * (does not resolve/close the alert — resolution only happens when the
 * underlying condition is objectively no longer present, per
 * `evaluateOperationalAlerts`).
 */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const env = getEnv();
  const db = createDb(env.DB);
  try {
    const alertId = Number(params.alertId);
    if (!Number.isInteger(alertId) || alertId <= 0) {
      throw new ApiError("VALIDATION_FAILED", "Invalid alert id.");
    }
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonErrorResponse(
        new Error("A reason is required (minimum 3 characters)."),
        requestId,
      );
    }
    const ctx = await requireAdminAction(request, db, {
      action: "operations.acknowledge_alert",
      target: `operational_alerts:${alertId}`,
      reason: parsed.data.reason,
      requestId,
    });
    const acknowledged = await acknowledgeOperationalAlert(db, alertId, ctx.user.id);
    if (!acknowledged) {
      throw new ApiError("NOT_FOUND", "Alert not found or already resolved.");
    }
    return jsonResponse(ok({ acknowledged: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
