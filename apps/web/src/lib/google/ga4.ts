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
