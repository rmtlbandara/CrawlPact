import type { APIRoute } from "astro";
import { ApiError } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { listDomains } from "../../../lib/domains";
import { getPlan } from "../../../lib/plan";
import { toCsv } from "../../../lib/csv";
import { jsonErrorResponse } from "../../../lib/json-response";

export const prerender = false;

/** GET /api/domains/export.csv — CSV export of saved domains; requires the plan's `csvExportEnabled` entitlement (SRS §10.40). */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const plan = await getPlan(db, user.planId);
    if (!plan.csvExportEnabled) {
      throw new ApiError("FORBIDDEN", "CSV export is not available on your current plan.");
    }

    const domains = await listDomains(db, user.id);
    const csv = toCsv(
      [
        "Domain",
        "Canonical origin",
        "Preset",
        "Monitoring",
        "Policy Health Score",
        "Open findings",
        "Last scan",
        "Next scan",
      ],
      domains.map((d) => [
        d.displayName,
        d.canonicalOrigin,
        d.preset,
        d.monitoringState,
        d.currentScore,
        d.openFindingsCount,
        d.lastScanAt,
        d.nextScanAt,
      ]),
    );

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="crawlpact-domains.csv"',
      },
    });
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
