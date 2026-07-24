import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminSession } from "../../../../lib/auth/require-admin";
import { listAllDomains } from "../../../../lib/admin/domains";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/** GET /api/admin/domains — SRS §28.8 global domain table. */
export const GET: APIRoute = async ({ request, url }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    const rows = await listAllDomains(db, {
      query: url.searchParams.get("q") ?? undefined,
      monitoringState:
        (url.searchParams.get("monitoringState") as "active" | "paused" | null) ?? undefined,
    });
    return jsonResponse(ok(rows, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
