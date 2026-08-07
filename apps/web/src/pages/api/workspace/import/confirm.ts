import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import { createDb } from "@crawlpact/database";
import { ApiError, importConfirmRequestSchema, ok } from "@crawlpact/core";
import { getEnv } from "../../../../lib/env";
import { requireSession } from "../../../../lib/auth/require-session";
import { getPlan } from "../../../../lib/plan";
import { getOwnedGroup } from "../../../../lib/groups";
import {
  buildImportContext,
  buildImportPlan,
  executeImportPlan,
} from "../../../../lib/portfolio-import";
import { trackEvent } from "../../../../lib/analytics";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/**
 * POST /api/workspace/import/confirm — creates domains for a previously
 * previewed CSV (docs/product/CSV_IMPORT_WORKFLOW.md). Never trusts the
 * client's earlier preview response: the raw CSV text is re-parsed and
 * re-validated here from scratch. Idempotent on `idempotencyKey` — a
 * retried submission with the same key returns the stored result instead
 * of creating duplicate domains.
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const plan = await getPlan(db, user.planId);
    if (plan.batchImportLimit <= 0) {
      throw new ApiError("FORBIDDEN", "Batch import is not available on your current plan.");
    }

    const body = await request.json().catch(() => {
      throw new ApiError("VALIDATION_FAILED", "Request body must be valid JSON.");
    });
    const parsed = importConfirmRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Invalid import request.", {
        issues: parsed.error.issues,
      });
    }

    const [existingJob] = await db
      .select()
      .from(schema.portfolioImportJobs)
      .where(
        and(
          eq(schema.portfolioImportJobs.ownerUserId, user.id),
          eq(schema.portfolioImportJobs.idempotencyKey, parsed.data.idempotencyKey),
        ),
      )
      .limit(1);
    if (existingJob) {
      const existingRows = await db
        .select()
        .from(schema.portfolioImportRows)
        .where(eq(schema.portfolioImportRows.jobId, existingJob.id));
      return jsonResponse(
        ok(
          {
            jobId: existingJob.id,
            status: existingJob.status,
            totalRows: existingJob.totalRows,
            createdDomains: existingJob.createdDomains,
            failedDomains: existingJob.failedDomains,
            rows: existingRows.map((r) => ({
              rowNumber: r.rowNumber,
              domain: r.normalisedOrigin ?? "",
              result: r.result,
              domainId: r.domainId ?? undefined,
            })),
          },
          requestId,
        ),
        200,
      );
    }

    if (parsed.data.groupId) {
      const group = await getOwnedGroup(db, user.id, parsed.data.groupId);
      if (!group) throw new ApiError("VALIDATION_FAILED", "This group does not exist.");
    }

    const context = await buildImportContext(db, user.id, plan.savedDomainLimit);
    const built = buildImportPlan(parsed.data.csvContent, {
      ownedGroupIdByName: context.ownedGroupIdByName,
      existingOrigins: context.existingOrigins,
      remainingCapacity: context.remainingCapacity,
      batchImportLimit: plan.batchImportLimit,
    });
    if (!built.ok) {
      throw new ApiError("VALIDATION_FAILED", "This file could not be read.");
    }

    const execution = await executeImportPlan(db, user.id, built.plan, {
      defaultGroupId: parsed.data.groupId ?? null,
      applyMonitoring: parsed.data.applyMonitoring,
      monitoringFrequency: plan.monitoringFrequency,
    });

    const status =
      execution.failedDomains === 0
        ? "completed"
        : execution.createdDomains === 0
          ? "failed"
          : "completed_with_errors";

    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(schema.portfolioImportJobs).values({
      id: jobId,
      ownerUserId: user.id,
      groupId: parsed.data.groupId ?? null,
      status,
      totalRows: built.plan.totalRows,
      validRows: built.plan.validRows,
      invalidRows: built.plan.invalidRows,
      createdDomains: execution.createdDomains,
      failedDomains: execution.failedDomains,
      monitoringRequested: parsed.data.applyMonitoring,
      idempotencyKey: parsed.data.idempotencyKey,
      createdAt: now,
      completedAt: now,
    });

    // D1's bound-parameter limit per statement (100) is well below plain
    // SQLite's — 7 columns/row means more than ~14 rows in one INSERT
    // VALUES statement would exceed it (confirmed by a real "too many SQL
    // variables" D1 error at 15 rows during testing). Chunked to a
    // conservative 10 rows/statement (70 params) so even the Agency
    // ceiling (100 rows) inserts safely across multiple statements.
    const IMPORT_ROW_INSERT_CHUNK_SIZE = 10;
    const rowValues = execution.rows.map((r) => ({
      id: crypto.randomUUID(),
      jobId,
      rowNumber: r.rowNumber,
      normalisedOrigin: r.domain,
      result: r.result,
      errorCode: r.result === "created" ? null : r.result,
      domainId: r.domainId ?? null,
    }));
    for (let i = 0; i < rowValues.length; i += IMPORT_ROW_INSERT_CHUNK_SIZE) {
      await db
        .insert(schema.portfolioImportRows)
        .values(rowValues.slice(i, i + IMPORT_ROW_INSERT_CHUNK_SIZE));
    }

    await trackEvent(db, "portfolio_import_confirmed", {
      userId: user.id,
      properties: { plan: plan.id, resultCategory: status },
    });
    await trackEvent(
      db,
      execution.failedDomains === 0 ? "portfolio_import_completed" : "portfolio_import_failed",
      {
        userId: user.id,
        properties: { plan: plan.id },
      },
    );

    return jsonResponse(
      ok(
        {
          jobId,
          status,
          totalRows: built.plan.totalRows,
          createdDomains: execution.createdDomains,
          failedDomains: execution.failedDomains,
          rows: execution.rows,
        },
        requestId,
      ),
      200,
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
