import type { APIRoute } from "astro";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminSession } from "../../../../../lib/auth/require-admin";
import { getAffectedDomains, validateReleaseCandidate } from "../../../../../lib/admin/registry";
import { computeSemanticDiff } from "../../../../../lib/registry-semantic-diff";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

/** GET /api/admin/registry/releases/compare?from=&to= — SRS §28.11 release
 * comparison + affected-domain preview before publication.
 *
 * Phase 15: uses the semantic diff (Section 44-45), which classifies each
 * field change as evaluation-semantic / evidence / editorial / internal —
 * only evaluation-semantic crawler IDs feed the affected-domain estimate,
 * so a source-URL refresh or wording edit no longer inflates the preview.
 */
export const GET: APIRoute = async ({ request, url }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to)
      throw new ApiError("VALIDATION_FAILED", "Both from and to version ids are required.");

    const [diff, validation] = await Promise.all([
      computeSemanticDiff(db, from, to),
      validateReleaseCandidate(db, to),
    ]);
    const affectedDomains = await getAffectedDomains(db, diff.evaluationSemanticCrawlerIds);

    return jsonResponse(ok({ diff, validation, affectedDomains }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
