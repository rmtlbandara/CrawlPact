import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminSession } from "../../../../lib/auth/require-admin";
import { getComponentHealth, getSystemStatusSummary } from "../../../../lib/admin/health";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/** GET /api/admin/health — SRS §28.10 internal health overview. */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    const [summary, components] = await Promise.all([
      getSystemStatusSummary(db),
      getComponentHealth(db),
    ]);
    return jsonResponse(ok({ summary, components }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
