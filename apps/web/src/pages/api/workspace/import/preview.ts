import type { APIRoute } from "astro";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireSession } from "../../../../lib/auth/require-session";
import { getPlan } from "../../../../lib/plan";
import {
  buildImportContext,
  buildImportPlan,
  IMPORT_MAX_FILE_BYTES,
} from "../../../../lib/portfolio-import";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

const BUILD_PLAN_ERROR_MESSAGES: Record<string, string> = {
  empty_file: "This file is empty.",
  too_many_rows: "This file has more rows than your plan's batch-import limit allows.",
  too_many_columns: "This file has too many columns.",
  field_too_long: "A field in this file is too long.",
  malformed_quoting: 'This file has an unterminated quoted field — check for a stray ".',
  missing_domain_column: 'This file is missing a required "domain" column.',
};

/**
 * POST /api/workspace/import/preview — validates an uploaded CSV file
 * without writing anything to the database (docs/product/CSV_IMPORT_WORKFLOW.md).
 * Local file upload only — no remote-URL import exists anywhere in this
 * route.
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

    const contentLength = Number(request.headers.get("Content-Length") ?? "0");
    if (contentLength > IMPORT_MAX_FILE_BYTES + 65_536) {
      throw new ApiError("VALIDATION_FAILED", "This file is too large.");
    }

    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");
    if (!(file instanceof File)) {
      throw new ApiError("VALIDATION_FAILED", "Missing file.");
    }
    if (file.size === 0 || file.size > IMPORT_MAX_FILE_BYTES) {
      throw new ApiError(
        "VALIDATION_FAILED",
        `File must be between 1 byte and ${IMPORT_MAX_FILE_BYTES} bytes.`,
      );
    }

    let csvText: string;
    try {
      const bytes = await file.arrayBuffer();
      csvText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new ApiError("VALIDATION_FAILED", "This file is not valid UTF-8 text.");
    }

    const context = await buildImportContext(db, user.id, plan.savedDomainLimit);
    const built = buildImportPlan(csvText, {
      ownedGroupIdByName: context.ownedGroupIdByName,
      existingOrigins: context.existingOrigins,
      remainingCapacity: context.remainingCapacity,
      batchImportLimit: plan.batchImportLimit,
    });
    if (!built.ok) {
      throw new ApiError(
        "VALIDATION_FAILED",
        BUILD_PLAN_ERROR_MESSAGES[built.error] ?? "This file could not be read.",
      );
    }

    return jsonResponse(
      ok(
        {
          totalRows: built.plan.totalRows,
          validRows: built.plan.validRows,
          invalidRows: built.plan.invalidRows,
          unsupportedColumns: built.plan.unsupportedColumns,
          rows: built.plan.rows.map((r) => ({
            rowNumber: r.rowNumber,
            domain: r.rawDomain,
            displayName: r.displayName,
            groupName: r.groupName,
            notes: r.notes,
            monitoringRequested: r.monitoringRequested ?? false,
            result: r.result,
          })),
          batchImportLimit: plan.batchImportLimit,
          remainingCapacity: context.remainingCapacity,
        },
        requestId,
      ),
      200,
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
