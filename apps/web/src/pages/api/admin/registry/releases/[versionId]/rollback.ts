import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import { ApiError, adminActionRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../../lib/env";
import { requireAdminAction } from "../../../../../../lib/auth/require-admin";
import {
  getAffectedDomains,
  rollbackRegistryVersion,
  scheduleReEvaluation,
} from "../../../../../../lib/admin/registry";
import { computeSemanticDiff } from "../../../../../../lib/registry-semantic-diff";
import { jsonErrorResponse, jsonResponse } from "../../../../../../lib/json-response";

export const prerender = false;

/**
 * POST /api/admin/registry/releases/:versionId/rollback — SRS §28.11:
 * repoints the active pointer to an older, already-published release.
 * Never deletes any release, never edits release history.
 *
 * Phase 15 fix (Section 65, "Rollback Re-Evaluation"): a rollback is a real
 * semantic release transition and can change domain evaluation exactly
 * like a forward publish — previously this route only moved the pointer
 * and left saved domains evaluated against the superseded state
 * indefinitely. Now computes the same semantic diff and schedules the same
 * bounded re-evaluation as `publish`.
 */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const versionId = params.versionId;
    if (!versionId) throw new ApiError("VALIDATION_FAILED", "Missing registry version id.");

    const body = adminActionRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("ADMIN_REASON_REQUIRED", "A reason is required.");

    const admin = await requireAdminAction(request, db, {
      action: "registry.release.rollback",
      target: versionId,
      reason: body.data.reason,
      requestId,
    });

    const [previouslyActive] = await db
      .select({ id: schema.registryVersions.id })
      .from(schema.registryVersions)
      .where(eq(schema.registryVersions.isActive, true))
      .limit(1);

    const result = await rollbackRegistryVersion(db, versionId, admin.user.id, body.data.reason);

    let scheduledCount = 0;
    if (!result.alreadyActive && previouslyActive && previouslyActive.id !== versionId) {
      const diff = await computeSemanticDiff(db, previouslyActive.id, versionId);
      const affected = await getAffectedDomains(db, diff.evaluationSemanticCrawlerIds);
      scheduledCount = await scheduleReEvaluation(
        db,
        affected.map((d) => d.domainId),
      );
    }

    return jsonResponse(
      ok(
        {
          versionId,
          active: true,
          alreadyActive: result.alreadyActive,
          domainsScheduledForReEvaluation: scheduledCount,
        },
        requestId,
      ),
      200,
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
