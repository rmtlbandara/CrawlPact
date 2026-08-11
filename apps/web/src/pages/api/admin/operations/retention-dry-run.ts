import type { APIRoute } from "astro";
import { z } from "zod";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminAction } from "../../../../lib/auth/require-admin";
import { runDataRetentionPurge } from "../../../../lib/data-retention";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

const bodySchema = z.object({ reason: z.string().trim().min(3).max(500) });

/**
 * POST /api/admin/operations/retention-dry-run — Phase 14 §44 "Re-run
 * retention dry-run". Always `dryRun: true` — this route has no way to
 * trigger a real purge outside the daily cron; it exists only so an
 * administrator can verify what the next scheduled run would affect,
 * reusing `runDataRetentionPurge`'s existing `dryRun` option (Phase 11)
 * rather than a second, parallel counting implementation.
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
      action: "operations.retention_dry_run",
      target: "data_retention",
      reason: parsed.data.reason,
      requestId,
    });
    const result = await runDataRetentionPurge(db, new Date(), {
      dryRun: true,
      agencyLogosBucket: env.AGENCY_LOGOS,
    });
    return jsonResponse(ok(result, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
