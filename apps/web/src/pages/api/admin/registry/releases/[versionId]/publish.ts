import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import { ApiError, adminActionRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../../lib/env";
import { requireAdminAction } from "../../../../../../lib/auth/require-admin";
import {
  compareRegistryVersions,
  getAffectedDomains,
  publishRegistryVersion,
  scheduleReEvaluation,
} from "../../../../../../lib/admin/registry";
import { jsonErrorResponse, jsonResponse } from "../../../../../../lib/json-response";

export const prerender = false;

/** POST /api/admin/registry/releases/:versionId/publish — SRS §28.11
 * publication (confirmed, reasoned, audited) + automatic re-evaluation
 * scheduling for domains whose crawler evaluation would change. */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const versionId = params.versionId;
    if (!versionId) throw new ApiError("VALIDATION_FAILED", "Missing registry version id.");

    const body = adminActionRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("ADMIN_REASON_REQUIRED", "A reason is required.");

    const admin = await requireAdminAction(request, db, {
      action: "registry.release.publish",
      target: versionId,
      reason: body.data.reason,
      requestId,
    });

    // Compute the diff against whichever release is active *before*
    // flipping the pointer, so the re-evaluation scheduling reflects what
    // is genuinely changing for customers.
    const [previouslyActive] = await db
      .select({ id: schema.registryVersions.id })
      .from(schema.registryVersions)
      .where(eq(schema.registryVersions.isActive, true))
      .limit(1);

    await publishRegistryVersion(db, versionId, admin.user.id);

    let scheduledCount = 0;
    if (previouslyActive && previouslyActive.id !== versionId) {
      const comparison = await compareRegistryVersions(db, previouslyActive.id, versionId);
      const changedCrawlerIds = [
        ...comparison.added,
        ...comparison.removed,
        ...comparison.changed.map((c) => c.crawlerId),
      ];
      const affected = await getAffectedDomains(db, changedCrawlerIds);
      scheduledCount = await scheduleReEvaluation(
        db,
        affected.map((d) => d.domainId),
      );
    }

    return jsonResponse(
      ok(
        { versionId, published: true, domainsScheduledForReEvaluation: scheduledCount },
        requestId,
      ),
      200,
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
