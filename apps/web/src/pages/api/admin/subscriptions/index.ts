import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminSession } from "../../../../lib/auth/require-admin";
import { listSubscriptions } from "../../../../lib/admin/subscriptions";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/** GET /api/admin/subscriptions — SRS §28.5. */
export const GET: APIRoute = async ({ request, url }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    const rows = await listSubscriptions(db, {
      planId: url.searchParams.get("plan") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      pastDue: url.searchParams.get("pastDue") === "true",
      cancelling: url.searchParams.get("cancelling") === "true",
      mismatchOnly: url.searchParams.get("mismatch") === "true",
      syncErrorOnly: url.searchParams.get("syncError") === "true",
      currentEnvironment: getEnv().PADDLE_ENVIRONMENT,
    });
    return jsonResponse(ok(rows, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
