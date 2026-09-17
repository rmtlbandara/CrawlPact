import {
  GOOGLE_ANALYTICS_READONLY_SCOPE,
  GOOGLE_SEARCH_CONSOLE_READONLY_SCOPE,
  getGoogleAccessToken,
} from "../google/service-account";
import { querySearchConsole } from "../google/search-console";
import type { SearchConsoleDimension } from "../google/search-console";
import { queryGa4DimensionedReport } from "../google/ga4";
import type { Ga4Dimension, Ga4DimensionedRow } from "../google/ga4";
import { queryCrux } from "../google/crux";
import type { GoogleReadFailureReason } from "../google/http";

/**
 * Turns the existing Google integration from a request-time diagnostic
 * (`../admin/google-insights.ts`, queried live on every dashboard load) into
 * a persistent daily control plane (Phase 1 Workstream E/F): one row per
 * (data_date, dimension) written to `gsc_daily_metrics` / `ga4_daily_metrics`
 * / `crux_snapshots`, so period-over-period deltas and rollups are cheap SQL
 * aggregations over already-collected history instead of repeated live API
 * calls. Intended to be called once a day from `worker.ts`'s `scheduled()`
 * handler, but takes no dependency on the Worker runtime itself beyond the
 * `D1Database` binding, so it is fully unit-testable with a fake `prepare`.
 *
 * Reuses every piece of the existing read-only integration (shared
 * service-account token exchange, provider clients, failure taxonomy) —
 * this is additive collection logic, not a second integration.
 */

type GscDimensionType = "site" | "query" | "page" | "device" | "country";
type Ga4DimensionType = "site" | "channel_group" | "landing_page" | "device";

export type GrowthCollectionConfig = {
  serviceAccountJson: string | undefined;
  ga4PropertyId: string | undefined;
  searchConsoleSiteUrl: string | undefined;
  cruxApiKey: string | undefined;
  cruxOrigin: string | undefined;
};

export type ProviderCollectionResult =
  | { status: "ok"; rowsWritten: number }
  | { status: "no_data" }
  | { status: GoogleReadFailureReason };

export type GrowthCollectionSummary = {
  dataDate: string;
  searchConsole: ProviderCollectionResult;
  ga4: ProviderCollectionResult;
  crux: ProviderCollectionResult;
};

type SharedToken =
  { ok: true; accessToken: string } | { ok: false; reason: GoogleReadFailureReason };

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "Yesterday" in UTC, relative to `referenceDate` — the last fully-completed
 * day, matching the existing diagnostic's own lag-aware convention
 * (`google-insights.ts`'s `searchConsoleDateRange`). */
function endOfYesterday(referenceDate: Date): Date {
  return new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate() - 1,
    ),
  );
}

const GSC_DIMENSION_SETS: Array<{ type: GscDimensionType; dims: SearchConsoleDimension[] }> = [
  { type: "site", dims: ["date"] },
  { type: "query", dims: ["date", "query"] },
  { type: "page", dims: ["date", "page"] },
  { type: "device", dims: ["date", "device"] },
  { type: "country", dims: ["date", "country"] },
];

/** Default trailing window re-collected on every scheduled run. Search
 * Console data settles over roughly 2-3 days (§8.1) — rather than track
 * per-day "is this settled yet" state, every run idempotently re-upserts
 * this whole window, so a day's row keeps quietly correcting itself for a
 * few days after it first appears until it reflects Google's final numbers.
 * A one-off baseline backfill (Workstream N) can pass a larger window. */
export const GSC_DEFAULT_WINDOW_DAYS = 5;

async function upsertGscRow(
  d1: D1Database,
  dataDate: string,
  dimensionType: GscDimensionType,
  dimensionValue: string,
  clicks: number,
  impressions: number,
  ctr: number,
  position: number,
): Promise<void> {
  await d1
    .prepare(
      `INSERT INTO gsc_daily_metrics (data_date, dimension_type, dimension_value, clicks, impressions, ctr, position)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (data_date, dimension_type, dimension_value) DO UPDATE SET
         clicks = excluded.clicks,
         impressions = excluded.impressions,
         ctr = excluded.ctr,
         position = excluded.position,
         collected_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .bind(dataDate, dimensionType, dimensionValue, clicks, impressions, ctr, position)
    .run();
}

async function collectSearchConsole(
  d1: D1Database,
  siteUrl: string | undefined,
  accessToken: SharedToken,
  referenceDate: Date,
  windowDays: number,
): Promise<ProviderCollectionResult> {
  if (!siteUrl) return { status: "not_configured" };
  if (!accessToken.ok) return { status: accessToken.reason };

  const end = endOfYesterday(referenceDate);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (windowDays - 1));
  const startDate = isoDate(start);
  const endDate = isoDate(end);

  let rowsWritten = 0;
  let sawOk = false;
  let lastFailure: GoogleReadFailureReason = "upstream_error";

  for (const { type, dims } of GSC_DIMENSION_SETS) {
    const result = await querySearchConsole({
      siteUrl,
      accessToken: accessToken.accessToken,
      startDate,
      endDate,
      dimensions: dims,
      rowLimit: type === "query" || type === "page" ? 500 : 50,
    });
    if (result.status === "no_data") {
      // A dimension with genuinely zero rows for the window (e.g. no
      // country breakdown yet) — not a failure, just nothing to write.
      sawOk = true;
      continue;
    }
    if (result.status !== "ok") {
      lastFailure = result.status;
      continue;
    }
    sawOk = true;
    for (const row of result.data.rows) {
      const rowDate = row.keys[0];
      if (!rowDate) continue;
      const dimensionValue = type === "site" ? "site" : (row.keys[1] ?? "(not set)");
      await upsertGscRow(
        d1,
        rowDate,
        type,
        dimensionValue,
        row.clicks,
        row.impressions,
        row.ctr,
        row.position,
      );
      rowsWritten++;
    }
  }

  if (!sawOk) return { status: lastFailure };
  return { status: "ok", rowsWritten };
}

const GA4_DIMENSION_SETS: Array<{ type: Ga4DimensionType; dimension: Ga4Dimension }> = [
  { type: "site", dimension: null },
  { type: "channel_group", dimension: "sessionDefaultChannelGroup" },
  { type: "landing_page", dimension: "landingPage" },
  { type: "device", dimension: "deviceCategory" },
];

async function upsertGa4Row(
  d1: D1Database,
  dataDate: string,
  dimensionType: Ga4DimensionType,
  row: Ga4DimensionedRow,
): Promise<void> {
  await d1
    .prepare(
      `INSERT INTO ga4_daily_metrics (data_date, dimension_type, dimension_value, active_users, new_users, sessions, engaged_sessions, key_events)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (data_date, dimension_type, dimension_value) DO UPDATE SET
         active_users = excluded.active_users,
         new_users = excluded.new_users,
         sessions = excluded.sessions,
         engaged_sessions = excluded.engaged_sessions,
         key_events = excluded.key_events,
         collected_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .bind(
      dataDate,
      dimensionType,
      row.dimensionValue,
      row.activeUsers,
      row.newUsers,
      row.sessions,
      row.engagedSessions,
      row.keyEvents,
    )
    .run();
}

async function collectGa4(
  d1: D1Database,
  propertyId: string | undefined,
  accessToken: SharedToken,
  referenceDate: Date,
): Promise<ProviderCollectionResult> {
  if (!propertyId) return { status: "not_configured" };
  if (!accessToken.ok) return { status: accessToken.reason };

  // GA4 has no comparable multi-day settling lag — a single completed day
  // is collected and upserted once, unlike GSC's re-collected window.
  const dataDate = isoDate(endOfYesterday(referenceDate));

  let rowsWritten = 0;
  let sawOk = false;
  let lastFailure: GoogleReadFailureReason = "upstream_error";

  for (const { type, dimension } of GA4_DIMENSION_SETS) {
    const result = await queryGa4DimensionedReport({
      propertyId,
      accessToken: accessToken.accessToken,
      startDate: dataDate,
      endDate: dataDate,
      dimension,
      limit: type === "landing_page" ? 100 : 20,
    });
    if (result.status === "no_data") {
      sawOk = true;
      continue;
    }
    if (result.status !== "ok") {
      lastFailure = result.status;
      continue;
    }
    sawOk = true;
    for (const row of result.data.rows) {
      await upsertGa4Row(d1, dataDate, type, row);
      rowsWritten++;
    }
  }

  if (!sawOk) return { status: lastFailure };
  return { status: "ok", rowsWritten };
}

async function collectCrux(
  d1: D1Database,
  apiKey: string | undefined,
  origin: string | undefined,
  dataDate: string,
): Promise<ProviderCollectionResult> {
  if (!apiKey || !origin) return { status: "not_configured" };

  const result = await queryCrux({ apiKey, origin });
  if (result.status !== "ok") return { status: result.status };

  const metrics = result.data.metrics;
  const lcp = metrics.largestContentfulPaint?.p75;
  const inp = metrics.interactionToNextPaint?.p75;
  const cls = metrics.cumulativeLayoutShift?.p75;

  await d1
    .prepare(
      `INSERT INTO crux_snapshots (data_date, origin, form_factor, lcp_p75_ms, inp_p75_ms, cls_p75)
       VALUES (?, ?, 'ALL', ?, ?, ?)
       ON CONFLICT (data_date, origin, form_factor) DO UPDATE SET
         lcp_p75_ms = excluded.lcp_p75_ms,
         inp_p75_ms = excluded.inp_p75_ms,
         cls_p75 = excluded.cls_p75,
         collected_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .bind(
      dataDate,
      origin,
      lcp != null ? Math.round(Number(lcp)) : null,
      inp != null ? Math.round(Number(inp)) : null,
      cls != null ? Number(cls) : null,
    )
    .run();

  return { status: "ok", rowsWritten: 1 };
}

/**
 * Collects and persists one day's worth of Search Console, GA4, and CrUX
 * data. Each provider is fully independent (own try-free branch below, own
 * result in the summary) so a GA4 misconfiguration can never prevent GSC or
 * CrUX from being collected and vice versa — matching the existing
 * diagnostic endpoint's own `Promise.all` isolation.
 */
export async function collectGrowthSnapshots(
  d1: D1Database,
  config: GrowthCollectionConfig,
  referenceDate: Date = new Date(),
  options?: { gscWindowDays?: number },
): Promise<GrowthCollectionSummary> {
  const dataDate = isoDate(endOfYesterday(referenceDate));
  const gscWindowDays = options?.gscWindowDays ?? GSC_DEFAULT_WINDOW_DAYS;

  const needsToken = Boolean(config.searchConsoleSiteUrl || config.ga4PropertyId);
  const tokenResult = needsToken
    ? await getGoogleAccessToken(config.serviceAccountJson, [
        GOOGLE_SEARCH_CONSOLE_READONLY_SCOPE,
        GOOGLE_ANALYTICS_READONLY_SCOPE,
      ])
    : null;

  const sharedToken: SharedToken = tokenResult
    ? tokenResult.ok
      ? { ok: true, accessToken: tokenResult.accessToken }
      : { ok: false, reason: tokenResult.reason }
    : { ok: false, reason: "not_configured" };

  const [searchConsole, ga4, crux] = await Promise.all([
    collectSearchConsole(
      d1,
      config.searchConsoleSiteUrl,
      sharedToken,
      referenceDate,
      gscWindowDays,
    ),
    collectGa4(d1, config.ga4PropertyId, sharedToken, referenceDate),
    collectCrux(d1, config.cruxApiKey, config.cruxOrigin, dataDate),
  ]);

  return { dataDate, searchConsole, ga4, crux };
}
