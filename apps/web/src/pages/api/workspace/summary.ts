import type { APIRoute } from "astro";
import { createDb } from "@crawlpact/database";
import { ok } from "@crawlpact/core";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { getPortfolioSummary, type PortfolioPeriod } from "../../../lib/portfolio";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

const VALID_PERIODS = new Set(["7d", "30d", "all"]);

/** GET /api/workspace/summary — explainable portfolio counts (docs/product/PORTFOLIO_SUMMARY_MODEL.md). */
export const GET: APIRoute = async ({ request, url }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const periodParam = url.searchParams.get("period") ?? "30d";
    const period = (VALID_PERIODS.has(periodParam) ? periodParam : "30d") as PortfolioPeriod;

    const summary = await getPortfolioSummary(db, user.id, period);
    return jsonResponse(ok(summary, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
