import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminSession } from "../../../../lib/auth/require-admin";
import { listWebhookEvents } from "../../../../lib/admin/webhooks";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/** GET /api/admin/webhooks — SRS §28.7. `payload_redacted` is already
 * redacted at storage time (webhook-processor.ts), so this route needs no
 * additional filtering to avoid exposing sensitive fields. */
export const GET: APIRoute = async ({ request, url }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    const rows = await listWebhookEvents(db, {
      status: url.searchParams.get("status") ?? undefined,
    });
    return jsonResponse(ok(rows, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
