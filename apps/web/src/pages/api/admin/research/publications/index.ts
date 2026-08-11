import type { APIRoute } from "astro";
import { ApiError, adminActionRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminAction, requireAdminSession } from "../../../../../lib/auth/require-admin";
import {
  generateRegistryLandscapeDraft,
  listResearchPublications,
} from "../../../../../lib/admin/research";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

/** GET /api/admin/research/publications — list every publication regardless
 * of status (Super Admin only; the public route only ever returns
 * published/corrected/withdrawn — see lib/admin/research.ts). */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    const publications = await listResearchPublications(db);
    return jsonResponse(ok({ publications }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

/**
 * POST /api/admin/research/publications — generates a new "AI Crawler
 * Registry Landscape" draft from the currently active registry release
 * (§75). Draft only — never publicly visible until a separate `publish`
 * action (§45).
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const body = adminActionRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("ADMIN_REASON_REQUIRED", "A reason is required.");

    const admin = await requireAdminAction(request, db, {
      action: "research.publication.generate_draft",
      target: "registry_landscape",
      reason: body.data.reason,
      requestId,
    });

    const result = await generateRegistryLandscapeDraft(db, { createdByUserId: admin.user.id });
    return jsonResponse(ok(result, requestId), 201);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
