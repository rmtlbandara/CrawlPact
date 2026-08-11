import type { APIRoute } from "astro";
import { z } from "zod";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminAction } from "../../../../lib/auth/require-admin";
import { reconcileMissingPolicyChangeNotifications } from "../../../../lib/notification-reconciliation";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

const bodySchema = z.object({ reason: z.string().trim().min(3).max(500) });

/**
 * POST /api/admin/operations/reconcile-notifications — Phase 14 §44
 * "Re-run notification reconciliation". Reuses the exact same, already
 * idempotent Phase 10 function the daily cron calls
 * (lib/notification-reconciliation.ts) — safe to call manually at any time,
 * bounded lookback/batch size, never re-sends an already-created
 * notification (dedupe-key unique index).
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
      action: "operations.reconcile_notifications",
      target: "notifications",
      reason: parsed.data.reason,
      requestId,
    });
    const result = await reconcileMissingPolicyChangeNotifications(db, new Date());
    return jsonResponse(ok(result, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
