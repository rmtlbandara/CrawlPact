import type { APIRoute } from "astro";
import { z } from "zod";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminAction } from "../../../../lib/auth/require-admin";
import { findAndCleanupOrphanedLogos } from "../../../../lib/r2-orphan-cleanup";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

const bodySchema = z.object({
  reason: z.string().trim().min(3).max(500),
  // Defaults to true: a real deletion requires explicitly opting out of the
  // safe default, not opting in — matching this codebase's standing
  // "never delete real data without explicit intent" rule.
  dryRun: z.boolean().default(true),
  maxObjects: z.number().int().min(1).max(1000).default(1000),
  graceMinutes: z.number().int().min(1).max(10_080).default(60),
  cursor: z.string().optional(),
});

/**
 * POST /api/admin/settings/r2-orphan-cleanup — Phase 11, Stage 11D. Bounded,
 * D1-reference-verified inventory (and optional deletion) of `AGENCY_LOGOS`
 * R2 objects no `shared_reports` row references any more — see
 * `lib/r2-orphan-cleanup.ts`'s doc comment for the safety model
 * (bounded pages, real reference confirmation, grace period). Always an
 * admin *action* (never just a session-gated read) even in dry-run mode:
 * this is the first place in the codebase that lists real R2 bucket
 * contents, and every admin operation on real customer-adjacent storage is
 * reasoned and audited per SRS §28.3, not just the destructive branch.
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
    const { reason, dryRun, maxObjects, graceMinutes, cursor } = parsed.data;

    await requireAdminAction(request, db, {
      action: dryRun ? "r2_orphan_cleanup.inspect" : "r2_orphan_cleanup.delete",
      target: "AGENCY_LOGOS",
      reason,
      requestId,
    });

    const result = await findAndCleanupOrphanedLogos(db, env.AGENCY_LOGOS, {
      dryRun,
      maxObjects,
      graceMinutes,
      cursor,
    });

    return jsonResponse(ok(result, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
