import type { APIRoute } from "astro";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminSession } from "../../../../../lib/auth/require-admin";
import { compareRegistryVersions, getAffectedDomains } from "../../../../../lib/admin/registry";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

/** GET /api/admin/registry/releases/compare?from=&to= — SRS §28.11 release
 * comparison + affected-domain preview before publication. */
export const GET: APIRoute = async ({ request, url }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to)
      throw new ApiError("VALIDATION_FAILED", "Both from and to version ids are required.");

    const comparison = await compareRegistryVersions(db, from, to);
    const changedCrawlerIds = [
      ...comparison.added,
      ...comparison.removed,
      ...comparison.changed.map((c) => c.crawlerId),
    ];
    const affectedDomains = await getAffectedDomains(db, changedCrawlerIds);

    return jsonResponse(ok({ comparison, affectedDomains }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
