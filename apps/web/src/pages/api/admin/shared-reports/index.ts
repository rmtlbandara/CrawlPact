import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminSession } from "../../../../lib/auth/require-admin";
import { listAllSharedReports } from "../../../../lib/sharing";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/** GET /api/admin/shared-reports — SRS §28.9 "Shared reports" nav item. */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    return jsonResponse(ok(await listAllSharedReports(db), requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
