import { fetchGoogleJson } from "./http";
import type { GoogleReadResult } from "./http";

/**
 * Read-only GA4 Data API client (Step 5). Returns a small, normalized
 * application-level result — never the raw `runReport` response shape —
 * so nothing upstream-specific (Google's dimension/metric header
 * structure) leaks through a public admin endpoint.
 */

export type Ga4Row = {
  date: string | null;
  activeUsers: number;
  sessions: number;
};

export type Ga4Report = {
  rowCount: number;
  rows: Ga4Row[];
  totals: { activeUsers: number; sessions: number };
};

export type Ga4QueryParams = {
  propertyId: string;
  accessToken: string;
  startDate: string;
  endDate: string;
  includeDateDimension?: boolean;
};

function parseMetricValue(value: unknown): number {
  if (typeof value !== "string") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Queries the GA4 Data API for a small, bounded report (activeUsers +
 * sessions over a short recent range, optionally by day). A response with
 * zero rows is a normal, successful outcome (no traffic in the requested
 * range), never treated as a permission failure — only a non-2xx response
 * is.
 */
export async function queryGa4Report(params: Ga4QueryParams): Promise<GoogleReadResult<Ga4Report>> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(params.propertyId)}:runReport`;

  const result = await fetchGoogleJson(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dateRanges: [{ startDate: params.startDate, endDate: params.endDate }],
      dimensions: params.includeDateDimension ? [{ name: "date" }] : [],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }],
    }),
  });
  if (!result.ok) return { status: result.status };

  const record = result.body as Record<string, unknown>;
  const rawRows = Array.isArray(record.rows) ? (record.rows as unknown[]) : [];

  const rows: Ga4Row[] = [];
  const totals = { activeUsers: 0, sessions: 0 };
  for (const raw of rawRows) {
    if (typeof raw !== "object" || raw === null) continue;
    const rowRecord = raw as Record<string, unknown>;
    const dimensionValues = Array.isArray(rowRecord.dimensionValues)
      ? (rowRecord.dimensionValues as unknown[])
      : [];
    const metricValues = Array.isArray(rowRecord.metricValues)
      ? (rowRecord.metricValues as unknown[])
      : [];

    const date =
      dimensionValues.length > 0 &&
      typeof (dimensionValues[0] as Record<string, unknown>)?.value === "string"
        ? ((dimensionValues[0] as Record<string, unknown>).value as string)
        : null;
    const activeUsers = parseMetricValue(
      (metricValues[0] as Record<string, unknown> | undefined)?.value,
    );
    const sessions = parseMetricValue(
      (metricValues[1] as Record<string, unknown> | undefined)?.value,
    );

    rows.push({ date, activeUsers, sessions });
    totals.activeUsers += activeUsers;
    totals.sessions += sessions;
  }

  return { status: "ok", data: { rowCount: rows.length, rows, totals } };
}

/**
 * The GA4 dimension a growth-collection call breaks its metrics down by —
 * one collection run per dimension, matching one `ga4_daily_metrics.
 * dimension_type` value each (Phase 1 Workstream E). `null` requests no
 * breakdown at all (the day's site-wide totals, `dimension_type = 'site'`).
 */
export type Ga4Dimension = "sessionDefaultChannelGroup" | "landingPage" | "deviceCategory" | null;

export type Ga4DimensionedRow = {
  dimensionValue: string;
  activeUsers: number;
  newUsers: number;
  sessions: number;
  engagedSessions: number;
  keyEvents: number;
};

export type Ga4DimensionedReport = {
  rowCount: number;
  rows: Ga4DimensionedRow[];
};

export type Ga4DimensionedQueryParams = {
  propertyId: string;
  accessToken: string;
  startDate: string;
  endDate: string;
  dimension: Ga4Dimension;
  /** Bounds the API's own row limit — GA4 sorts by the first metric
   * descending by default when no orderBy is specified, so a small limit
   * still returns the most meaningful rows for a breakdown dimension. */
  limit?: number;
};

const GA4_DIMENSIONED_METRICS = [
  { name: "activeUsers" },
  { name: "newUsers" },
  { name: "sessions" },
  { name: "engagedSessions" },
  { name: "keyEvents" },
];

/**
 * Queries the GA4 Data API for daily acquisition/engagement metrics,
 * optionally broken down by one dimension (channel group, landing page, or
 * device category). Reuses the same shared HTTP/token-exchange plumbing as
 * `queryGa4Report` — this is an additive client function, not a
 * replacement, since the existing diagnostic endpoint still depends on
 * `queryGa4Report`'s narrower shape.
 */
export async function queryGa4DimensionedReport(
  params: Ga4DimensionedQueryParams,
): Promise<GoogleReadResult<Ga4DimensionedReport>> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(params.propertyId)}:runReport`;

  const result = await fetchGoogleJson(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dateRanges: [{ startDate: params.startDate, endDate: params.endDate }],
      dimensions: params.dimension ? [{ name: params.dimension }] : [],
      metrics: GA4_DIMENSIONED_METRICS,
      limit: params.limit ?? 100,
    }),
  });
  if (!result.ok) return { status: result.status };

  const record = result.body as Record<string, unknown>;
  const rawRows = Array.isArray(record.rows) ? (record.rows as unknown[]) : [];

  const rows: Ga4DimensionedRow[] = [];
  for (const raw of rawRows) {
    if (typeof raw !== "object" || raw === null) continue;
    const rowRecord = raw as Record<string, unknown>;
    const dimensionValues = Array.isArray(rowRecord.dimensionValues)
      ? (rowRecord.dimensionValues as unknown[])
      : [];
    const metricValues = Array.isArray(rowRecord.metricValues)
      ? (rowRecord.metricValues as unknown[])
      : [];

    const dimensionValue =
      dimensionValues.length > 0 &&
      typeof (dimensionValues[0] as Record<string, unknown>)?.value === "string"
        ? ((dimensionValues[0] as Record<string, unknown>).value as string)
        : "(not set)";

    rows.push({
      dimensionValue: params.dimension ? dimensionValue : "site",
      activeUsers: parseMetricValue(
        (metricValues[0] as Record<string, unknown> | undefined)?.value,
      ),
      newUsers: parseMetricValue((metricValues[1] as Record<string, unknown> | undefined)?.value),
      sessions: parseMetricValue((metricValues[2] as Record<string, unknown> | undefined)?.value),
      engagedSessions: parseMetricValue(
        (metricValues[3] as Record<string, unknown> | undefined)?.value,
      ),
      keyEvents: parseMetricValue((metricValues[4] as Record<string, unknown> | undefined)?.value),
    });
  }

  return { status: "ok", data: { rowCount: rows.length, rows } };
}
