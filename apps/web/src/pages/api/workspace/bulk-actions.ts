import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import { createDb } from "@crawlpact/database";
import { ApiError, bulkActionRequestSchema, ok } from "@crawlpact/core";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { getPlan } from "../../../lib/plan";
import { executeBulkAction } from "../../../lib/bulk-actions";
import { trackEvent } from "../../../lib/analytics";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

/**
 * POST /api/workspace/bulk-actions — bounded bulk domain organisation and
 * monitoring actions (docs/product/BULK_ACTION_MODEL.md). Every selected
 * domain ID is re-validated against ownership at execution time; the
 * plan is re-read fresh (protects against a race with a plan downgrade
 * between selection and submission). Idempotent on `idempotencyKey`.
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const body = await request.json().catch(() => {
      throw new ApiError("VALIDATION_FAILED", "Request body must be valid JSON.");
    });
    const parsed = bulkActionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Invalid bulk-action request.", {
        issues: parsed.error.issues,
      });
    }

    const [existingJob] = await db
      .select()
      .from(schema.bulkActionJobs)
      .where(
        and(
          eq(schema.bulkActionJobs.ownerUserId, user.id),
          eq(schema.bulkActionJobs.idempotencyKey, parsed.data.idempotencyKey),
        ),
      )
      .limit(1);
    if (existingJob) {
      return jsonResponse(
        ok(
          {
            jobId: existingJob.id,
            status: existingJob.status,
            requestedCount: existingJob.requestedCount,
            succeededCount: existingJob.succeededCount,
            skippedCount: existingJob.skippedCount,
            failedCount: existingJob.failedCount,
            results: [],
          },
          requestId,
        ),
        200,
      );
    }

    const plan = await getPlan(db, user.planId);
    if (
      (parsed.data.action === "assign_group" || parsed.data.action === "move_group") &&
      !plan.domainGroupsEnabled
    ) {
      throw new ApiError("FORBIDDEN", "Domain groups are not available on your current plan.");
    }

    const results = await executeBulkAction(
      db,
      user.id,
      parsed.data.action,
      parsed.data.domainIds,
      {
        groupId: parsed.data.groupId ?? null,
        monitoringFrequency: plan.monitoringFrequency,
      },
    );

    const succeededCount = results.filter((r) => r.outcome === "succeeded").length;
    const skippedCount = results.filter((r) => r.outcome === "skipped").length;
    const failedCount = results.filter((r) => r.outcome === "failed").length;
    const status =
      failedCount === 0 ? "completed" : succeededCount === 0 ? "failed" : "completed_with_errors";

    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(schema.bulkActionJobs).values({
      id: jobId,
      ownerUserId: user.id,
      action: parsed.data.action,
      status,
      requestedCount: parsed.data.domainIds.length,
      succeededCount,
      skippedCount,
      failedCount,
      idempotencyKey: parsed.data.idempotencyKey,
      createdAt: now,
      completedAt: now,
    });

    await trackEvent(db, "bulk_action_completed", {
      userId: user.id,
      properties: { plan: plan.id, actionType: parsed.data.action, resultCategory: status },
    });

    return jsonResponse(
      ok(
        {
          jobId,
          status,
          requestedCount: parsed.data.domainIds.length,
          succeededCount,
          skippedCount,
          failedCount,
          results,
        },
        requestId,
      ),
      200,
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
