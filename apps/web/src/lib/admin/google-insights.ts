import {
  GOOGLE_ANALYTICS_READONLY_SCOPE,
  GOOGLE_SEARCH_CONSOLE_READONLY_SCOPE,
  getGoogleAccessToken,
} from "../google/service-account";
import { querySearchConsole } from "../google/search-console";
import type { SearchConsoleRow } from "../google/search-console";
import { queryGa4Report } from "../google/ga4";
import { queryCrux } from "../google/crux";
import type { CruxReport } from "../google/crux";
import type { GoogleReadFailureReason } from "../google/http";

/**
 * Orchestrates the three read-only Google connectivity checks for
 * `GET /api/admin/integrations/google-insights` (Step 8). Each of the
 * three sections below independently maps its own "is this even
 * configured" / "did the shared token exchange succeed" / "did the API
 * call itself succeed" outcomes into one small status per service — a
 * failure in one (e.g. GA4 misconfigured) never prevents the others from
 * reporting normally, matching the endpoint's job as a diagnostic, not a
 * single pass/fail gate.
 */

export type GoogleServiceStatus = "ok" | "no_data" | GoogleReadFailureReason;

export type SearchConsoleSummary = {
  status: GoogleServiceStatus;
  rowCount?: number;
  topRows?: Pick<SearchConsoleRow, "keys" | "clicks" | "impressions">[];
};

export type Ga4Summary = {
  status: GoogleServiceStatus;
  rowCount?: number;
  totals?: { activeUsers: number; sessions: number };
};

export type CruxSummary = {
  status: GoogleServiceStatus;
  metrics?: CruxReport["metrics"];
};

export type GoogleInsightsSnapshot = {
  searchConsole: SearchConsoleSummary;
  ga4: Ga4Summary;
  crux: CruxSummary;
};

export type GoogleInsightsConfig = {
  serviceAccountJson: string | undefined;
  ga4PropertyId: string | undefined;
  searchConsoleSiteUrl: string | undefined;
  cruxApiKey: string | undefined;
  cruxOrigin: string | undefined;
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Search Console data typically lags 2–3 days; ending "yesterday" and
 * spanning 28 days keeps the query inside data Google has actually
 * finished aggregating, per Step 4's "approximately the last 28 completed
 * days" guidance. */
function searchConsoleDateRange(referenceDate: Date): { startDate: string; endDate: string } {
  const end = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate() - 1,
    ),
  );
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

async function getSearchConsoleSummary(
  siteUrl: string | undefined,
  accessToken: { ok: true; accessToken: string } | { ok: false; reason: GoogleServiceStatus },
  referenceDate: Date,
): Promise<SearchConsoleSummary> {
  if (!siteUrl) return { status: "not_configured" };
  if (!accessToken.ok) return { status: accessToken.reason };

  const { startDate, endDate } = searchConsoleDateRange(referenceDate);
  const result = await querySearchConsole({
    siteUrl,
    accessToken: accessToken.accessToken,
    startDate,
    endDate,
    rowLimit: 10,
    dimensions: ["query"],
  });

  if (result.status !== "ok") return { status: result.status };
  return {
    status: "ok",
    rowCount: result.data.rowCount,
    topRows: result.data.rows
      .slice(0, 5)
      .map(({ keys, clicks, impressions }) => ({ keys, clicks, impressions })),
  };
}

async function getGa4Summary(
  propertyId: string | undefined,
  accessToken: { ok: true; accessToken: string } | { ok: false; reason: GoogleServiceStatus },
): Promise<Ga4Summary> {
  if (!propertyId) return { status: "not_configured" };
  if (!accessToken.ok) return { status: accessToken.reason };

  const result = await queryGa4Report({
    propertyId,
    accessToken: accessToken.accessToken,
    startDate: "7daysAgo",
    endDate: "yesterday",
    includeDateDimension: true,
  });

  if (result.status !== "ok") return { status: result.status };
  return { status: "ok", rowCount: result.data.rowCount, totals: result.data.totals };
}

async function getCruxSummary(
  apiKey: string | undefined,
  origin: string | undefined,
): Promise<CruxSummary> {
  if (!apiKey || !origin) return { status: "not_configured" };

  const result = await queryCrux({ apiKey, origin });
  if (result.status !== "ok") return { status: result.status };
  return { status: "ok", metrics: result.data.metrics };
}

/**
 * Search Console and GA4 share one service-account access token (both
 * scopes requested together, Step 3) — the token is exchanged at most once
 * per call here, never once per provider.
 */
export async function getGoogleInsightsSnapshot(
  config: GoogleInsightsConfig,
  referenceDate: Date = new Date(),
): Promise<GoogleInsightsSnapshot> {
  const needsToken = Boolean(config.searchConsoleSiteUrl || config.ga4PropertyId);

  const tokenResult = needsToken
    ? await getGoogleAccessToken(config.serviceAccountJson, [
        GOOGLE_SEARCH_CONSOLE_READONLY_SCOPE,
        GOOGLE_ANALYTICS_READONLY_SCOPE,
      ])
    : null;

  const sharedToken:
    { ok: true; accessToken: string } | { ok: false; reason: GoogleServiceStatus } = tokenResult
    ? tokenResult.ok
      ? { ok: true, accessToken: tokenResult.accessToken }
      : { ok: false, reason: tokenResult.reason }
    : { ok: false, reason: "not_configured" };

  const [searchConsole, ga4, crux] = await Promise.all([
    getSearchConsoleSummary(config.searchConsoleSiteUrl, sharedToken, referenceDate),
    getGa4Summary(config.ga4PropertyId, sharedToken),
    getCruxSummary(config.cruxApiKey, config.cruxOrigin),
  ]);

  return { searchConsole, ga4, crux };
}
