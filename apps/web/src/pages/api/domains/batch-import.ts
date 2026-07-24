import type { APIRoute } from "astro";
import { ApiError, batchImportRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { batchImportDomains } from "../../../lib/domains";
import { getOwnedGroup } from "../../../lib/groups";
import { getPlan } from "../../../lib/plan";
import { trackEvent } from "../../../lib/analytics";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

/**
 * POST /api/domains/batch-import — SRS §29 agency batch CSV import.
 * `targets` is a raw list already split client-side (from a pasted CSV
 * column or textarea); every row's outcome is reported back individually,
 * matching "review import errors" rather than a single pass/fail result.
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const body = await request.json().catch(() => {
      throw new ApiError("VALIDATION_FAILED", "Request body must be valid JSON.");
    });
    const parsed = batchImportRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Provide between 1 and 200 domains to import.", {
        issues: parsed.error.issues,
      });
    }

    if (parsed.data.groupId) {
      const group = await getOwnedGroup(db, user.id, parsed.data.groupId);
      if (!group) throw new ApiError("VALIDATION_FAILED", "This group does not exist.");
    }

    const plan = await getPlan(db, user.planId);
    const result = await batchImportDomains(db, user.id, {
      targets: parsed.data.targets,
      groupId: parsed.data.groupId ?? null,
      savedDomainLimit: plan.savedDomainLimit,
      batchImportLimit: plan.batchImportLimit,
      monitoringFrequency: plan.monitoringFrequency,
    });

    if (result.savedCount > 0) {
      await trackEvent(db, "domain_saved", { userId: user.id });
    }

    return jsonResponse(ok(result, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
