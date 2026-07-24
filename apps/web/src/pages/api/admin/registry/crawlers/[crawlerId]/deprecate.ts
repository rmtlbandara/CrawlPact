import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { LIFECYCLE_STATUSES } from "@crawlpact/registry";
import { getEnv } from "../../../../../../lib/env";
import { requireAdminAction } from "../../../../../../lib/auth/require-admin";
import { deprecateCrawler } from "../../../../../../lib/admin/registry";
import { jsonErrorResponse, jsonResponse } from "../../../../../../lib/json-response";

export const prerender = false;

const bodySchema = z.object({
  status: z.enum(LIFECYCLE_STATUSES),
  replacementCrawlerId: z.string().optional(),
  reason: z.string().trim().min(3).max(500),
});

/** POST /api/admin/registry/crawlers/:crawlerId/deprecate — SRS §28.11
 * lifecycle management + replacement relationships. */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const crawlerId = params.crawlerId;
    if (!crawlerId) throw new ApiError("VALIDATION_FAILED", "Missing crawler id.");

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success)
      throw new ApiError("VALIDATION_FAILED", "A status and reason are required.");

    await requireAdminAction(request, db, {
      action: "registry.crawler.change_lifecycle",
      target: crawlerId,
      reason: parsed.data.reason,
      requestId,
      newState: {
        status: parsed.data.status,
        replacementCrawlerId: parsed.data.replacementCrawlerId,
      },
    });

    await deprecateCrawler(db, crawlerId, {
      status: parsed.data.status,
      replacementCrawlerId: parsed.data.replacementCrawlerId,
    });
    return jsonResponse(ok({ crawlerId, lifecycleStatus: parsed.data.status }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
