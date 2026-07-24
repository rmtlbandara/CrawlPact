import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminSession } from "../../../../lib/auth/require-admin";
import {
  detectSchedulerAnomalies,
  isSchedulerPaused,
  listScheduledJobRuns,
} from "../../../../lib/admin/scheduler";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/** GET /api/admin/jobs — SRS §28.10 scheduled-job history + anomaly detection. */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    const [runs, anomalies, paused] = await Promise.all([
      listScheduledJobRuns(db),
      detectSchedulerAnomalies(db),
      isSchedulerPaused(db),
    ]);
    return jsonResponse(ok({ runs, anomalies, paused }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
