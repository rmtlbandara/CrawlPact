import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../../lib/env";
import { requireAdminAction } from "../../../../../../lib/auth/require-admin";
import { verifyCrawler } from "../../../../../../lib/admin/registry";
import { jsonErrorResponse, jsonResponse } from "../../../../../../lib/json-response";

export const prerender = false;

const bodySchema = z.object({
  officialSourceUrl: z.string().url(),
  reason: z.string().trim().min(3).max(500),
});

/** POST /api/admin/registry/crawlers/:crawlerId/verify — SRS §28.11/FR-REG-005:
 * moves a draft to `active` only against explicit, mandatory source evidence. */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const crawlerId = params.crawlerId;
    if (!crawlerId) throw new ApiError("VALIDATION_FAILED", "Missing crawler id.");

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success)
      throw new ApiError("VALIDATION_FAILED", "A source URL and reason are required.");

    const admin = await requireAdminAction(request, db, {
      action: "registry.crawler.verify",
      target: crawlerId,
      reason: parsed.data.reason,
      requestId,
      newState: { officialSourceUrl: parsed.data.officialSourceUrl, lifecycleStatus: "active" },
    });

    await verifyCrawler(db, crawlerId, {
      officialSourceUrl: parsed.data.officialSourceUrl,
      approvedByUserId: admin.user.id,
    });
    return jsonResponse(ok({ crawlerId, lifecycleStatus: "active" }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
