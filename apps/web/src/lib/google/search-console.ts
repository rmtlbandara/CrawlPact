import { fetchGoogleJson } from "./http";
import type { GoogleReadResult } from "./http";

/**
 * Read-only Search Console Search Analytics client (Step 4 of the Google
 * insights integration). `siteUrl` is expected to be a domain property
 * (`sc-domain:crawlpact.com`, from `GOOGLE_SEARCH_CONSOLE_SITE_URL`) —
 * `encodeURIComponent` correctly escapes the `:` either way, and the same
 * function also handles a URL-prefix property (`https://example.com/`) if
 * that's ever configured instead.
 */

export type SearchConsoleRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchConsoleReport = {
  rowCount: number;
  rows: SearchConsoleRow[];
};

export type SearchConsoleDimension = "date" | "query" | "page" | "device" | "country";

export type SearchConsoleQueryParams = {
  siteUrl: string;
  accessToken: string;
  startDate: string;
  endDate: string;
  rowLimit?: number;
  dimensions?: SearchConsoleDimension[];
};

function toSearchConsoleRow(raw: unknown): SearchConsoleRow | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  return {
    keys: Array.isArray(record.keys)
      ? record.keys.filter((k): k is string => typeof k === "string")
      : [],
    clicks: typeof record.clicks === "number" ? record.clicks : 0,
    impressions: typeof record.impressions === "number" ? record.impressions : 0,
    ctr: typeof record.ctr === "number" ? record.ctr : 0,
    position: typeof record.position === "number" ? record.position : 0,
  };
}

/**
 * Queries the Search Analytics API for a bounded, small report. A response
 * with zero rows is a normal, successful outcome (a genuinely quiet
 * property, or a very recent site with no indexed history yet) — it is
 * never treated as an auth/permission failure, only an actual non-2xx
 * response is.
 */
export async function querySearchConsole(
  params: SearchConsoleQueryParams,
): Promise<GoogleReadResult<SearchConsoleReport>> {
  const encodedSite = encodeURIComponent(params.siteUrl);
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`;

  const result = await fetchGoogleJson(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: params.dimensions ?? [],
      rowLimit: params.rowLimit ?? 10,
    }),
  });
  if (!result.ok) return { status: result.status };

  const rawRows = Array.isArray((result.body as Record<string, unknown>)?.rows)
    ? ((result.body as Record<string, unknown>).rows as unknown[])
    : [];
  const rows = rawRows
    .map(toSearchConsoleRow)
    .filter((row): row is SearchConsoleRow => row !== null);

  return { status: "ok", data: { rowCount: rows.length, rows } };
}
