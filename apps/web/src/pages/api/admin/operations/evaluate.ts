import type { APIRoute } from "astro";
import { z } from "zod";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminAction } from "../../../../lib/auth/require-admin";
import { evaluateOperationalAlerts } from "../../../../lib/admin/operational-alerts";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

const bodySchema = z.object({ reason: z.string().trim().min(3).max(500) });

/**
 * POST /api/admin/operations/evaluate — Phase 14 §44 "Re-run health
 * evaluation". Safe to call any time: `evaluateOperationalAlerts` only ever
 * reads already-committed data and upserts deduplicated alert rows (never
 * creates one row per call) — see lib/admin/operational-alerts.ts.
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const env = getEnv();
  const db = createDb(env.DB);
  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonErrorResponse(
        new Error("A reason is required (minimum 3 characters)."),
        requestId,
      );
    }
    await requireAdminAction(request, db, {
      action: "operations.evaluate_health",
      target: "operational_alerts",
      reason: parsed.data.reason,
      requestId,
    });
    const result = await evaluateOperationalAlerts(db, env.DB, env.AGENCY_LOGOS);
    return jsonResponse(ok(result, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
