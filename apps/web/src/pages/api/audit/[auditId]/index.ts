import type { APIRoute } from "astro";
import { ApiError, fail, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { getScanState } from "../../../../lib/get-scan-report";

export const prerender = false;

/** GET /api/audit/:auditId — audit progress/state (SRS FR-AUD-002). */
export const GET: APIRoute = async ({ params }) => {
  const requestId = crypto.randomUUID();
  const auditId = params.auditId;

  if (!auditId) {
    return jsonResponse(
      fail(new ApiError("VALIDATION_FAILED", "Missing audit id."), requestId),
      400,
    );
  }

  const db = createDb(getEnv().DB);
  const state = await getScanState(db, auditId);

  if (!state) {
    return jsonResponse(
      fail(new ApiError("AUDIT_NOT_FOUND", "This audit does not exist."), requestId),
      404,
    );
  }

  return jsonResponse(ok(state, requestId), 200);
};

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
