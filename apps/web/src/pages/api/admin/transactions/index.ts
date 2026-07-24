import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminSession } from "../../../../lib/auth/require-admin";
import { listTransactions } from "../../../../lib/admin/subscriptions";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/** GET /api/admin/transactions — SRS §28.6. Only fields Paddle actually
 * sends are ever returned — no fabricated fee/net figures. */
export const GET: APIRoute = async ({ request, url }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    const rows = await listTransactions(db, {
      userId: url.searchParams.get("userId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });
    return jsonResponse(ok(rows, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
