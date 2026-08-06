import type { APIRoute } from "astro";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../../lib/env";
import { requireSession } from "../../../../../../lib/auth/require-session";
import { getOwnedDomain } from "../../../../../../lib/domains";
import { compareScans } from "../../../../../../lib/domain-comparison";
import { trackEvent } from "../../../../../../lib/analytics";
import { jsonErrorResponse, jsonResponse } from "../../../../../../lib/json-response";

export const prerender = false;

/**
 * GET /api/domains/:domainId/compare/:previousScanId/:currentScanId (Phase
 * 8). Ownership of the *domain* is verified first; `compareScans()` itself
 * re-validates that both scan IDs actually belong to this domain before
 * touching any evidence — a scan ID from another account never returns
 * data, and returns the same `incompatible` shape a made-up ID would (no
 * existence oracle). See docs/product/DOMAIN_COMPARISON_MODEL.md.
 */
export const GET: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);
    const { domainId, previousScanId, currentScanId } = params;
    if (!domainId || !previousScanId || !currentScanId) {
      throw new ApiError("VALIDATION_FAILED", "Missing domain or scan id.");
    }

    const domain = await getOwnedDomain(db, user.id, domainId);
    if (!domain) throw new ApiError("NOT_FOUND", "This domain does not exist.");

    const result = await compareScans(db, domainId, previousScanId, currentScanId);
    await trackEvent(db, "domain_comparison_opened", { userId: user.id });

    return jsonResponse(ok(result, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
