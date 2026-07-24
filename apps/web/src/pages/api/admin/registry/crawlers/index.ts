import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { CRAWLER_PURPOSES } from "@crawlpact/registry";
import { getEnv } from "../../../../../lib/env";
import { requireAdminAction, requireAdminSession } from "../../../../../lib/auth/require-admin";
import { createCrawlerDraft, listCrawlers } from "../../../../../lib/admin/registry";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

const createSchema = z.object({
  operatorId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  userAgentToken: z.string().trim().min(1).max(200),
  purpose: z.enum(CRAWLER_PURPOSES),
  description: z.string().trim().min(1).max(2000),
  officialSourceUrl: z.string().url(),
  reason: z.string().trim().min(3).max(500),
});

/** GET /api/admin/registry/crawlers — SRS §28.11. */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    return jsonResponse(ok(await listCrawlers(db), requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

/** POST /api/admin/registry/crawlers — creates a draft crawler, always
 * `unverified` until explicitly verified (FR-REG-005). */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "All crawler fields and a reason are required.", {
        issues: parsed.error.issues,
      });
    }

    const admin = await requireAdminAction(request, db, {
      action: "registry.crawler.create_draft",
      target: parsed.data.userAgentToken,
      reason: parsed.data.reason,
      requestId,
    });

    const id = await createCrawlerDraft(db, {
      operatorId: parsed.data.operatorId,
      name: parsed.data.name,
      userAgentToken: parsed.data.userAgentToken,
      purpose: parsed.data.purpose,
      description: parsed.data.description,
      officialSourceUrl: parsed.data.officialSourceUrl,
      approvedByUserId: admin.user.id,
    });

    return jsonResponse(ok({ id }, requestId), 201);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
