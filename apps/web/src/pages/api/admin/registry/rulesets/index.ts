import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminAction, requireAdminSession } from "../../../../../lib/auth/require-admin";
import { createRulesetVersion, listRulesetVersions } from "../../../../../lib/admin/registry";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

const createSchema = z.object({
  versionLabel: z.string().trim().min(1).max(50),
  description: z.string().trim().min(3).max(2000),
});

/** GET /api/admin/registry/rulesets — SRS §28.12 ruleset version management. */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    return jsonResponse(ok(await listRulesetVersions(db), requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

/** POST /api/admin/registry/rulesets — registers a new ruleset version.
 * `description` doubles as the audited reason, matching the same
 * "release notes are the reason" pattern as registry releases. */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success)
      throw new ApiError("VALIDATION_FAILED", "A version label and description are required.");

    await requireAdminAction(request, db, {
      action: "registry.ruleset.create",
      target: parsed.data.versionLabel,
      reason: parsed.data.description,
      requestId,
    });

    const id = await createRulesetVersion(db, parsed.data);
    return jsonResponse(ok({ id }, requestId), 201);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
