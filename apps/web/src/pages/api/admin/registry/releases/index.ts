import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { requireAdminAction, requireAdminSession } from "../../../../../lib/auth/require-admin";
import { createRegistryRelease, listRegistryVersions } from "../../../../../lib/admin/registry";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

const createSchema = z.object({
  versionLabel: z.string().trim().min(1).max(50),
  changelog: z.string().trim().min(3).max(5000),
});

/** GET /api/admin/registry/releases — SRS §28.11. */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    return jsonResponse(ok(await listRegistryVersions(db), requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

/** POST /api/admin/registry/releases — snapshots the current crawler set
 * into a new, unpublished release. `changelog` doubles as the mandatory
 * release notes AND the audited reason (SRS §28.11: "mandatory release notes"). */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "A version label and release notes are required.");
    }

    await requireAdminAction(request, db, {
      action: "registry.release.create",
      target: parsed.data.versionLabel,
      reason: parsed.data.changelog,
      requestId,
    });

    const id = await createRegistryRelease(db, parsed.data);
    return jsonResponse(ok({ id }, requestId), 201);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
