import { and, desc, eq, gte, sql } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

/**
 * Phase 1 Workstream G: reads the daily snapshots `lib/growth/collect.ts`
 * persists (`gsc_daily_metrics` / `ga4_daily_metrics` / `crux_snapshots`)
 * into the shapes the Super Admin growth dashboard renders. Every number
 * here is a SQL aggregation over already-collected rows — no live Google
 * API call happens on a dashboard page load, unlike the older
 * `../admin/google-insights.ts` diagnostic this complements (kept
 * unchanged as the live connectivity check; this is the historical view).
 *
 * A period with zero collected rows is a real, honest "no data yet" state
 * (Workstream T) — every totals helper below returns `hasData: false`
 * rather than fabricating a zero trend line.
 */

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type PeriodTotals = {
  hasData: boolean;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type PeriodComparison = {
  current: PeriodTotals;
  previous: PeriodTotals;
  clicksDeltaPct: number | null;
  impressionsDeltaPct: number | null;
};

export type TopRow = { value: string; clicks: number; impressions: number };

export type GscGrowthSummary = {
  last7Days: PeriodTotals;
  last28Days: PeriodComparison;
  topQueries: TopRow[];
  topPages: TopRow[];
  devices: TopRow[];
  countries: TopRow[];
  lastCollectedAt: string | null;
};

export type Ga4PeriodTotals = {
  hasData: boolean;
  activeUsers: number;
  newUsers: number;
  sessions: number;
  engagedSessions: number;
  keyEvents: number;
};

export type Ga4ChannelRow = {
  value: string;
  activeUsers: number;
  sessions: number;
  engagedSessions: number;
};

export type Ga4GrowthSummary = {
  last7Days: Ga4PeriodTotals;
  channels: Ga4ChannelRow[];
  topLandingPages: Ga4ChannelRow[];
  lastCollectedAt: string | null;
};

export type CruxGrowthSummary =
  | {
      status: "ok";
      dataDate: string;
      lcpP75Ms: number | null;
      inpP75Ms: number | null;
      clsP75: number | null;
    }
  | { status: "no_data" };

export type GrowthDashboard = {
  referenceDataDate: string;
  gsc: GscGrowthSummary;
  ga4: Ga4GrowthSummary;
  crux: CruxGrowthSummary;
};

function toDateRange(referenceDate: Date, days: number): { start: string; end: string } {
  const end = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate() - 1,
    ),
  );
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { start: isoDate(start), end: isoDate(end) };
}

async function gscSiteTotals(db: Database, start: string, end: string): Promise<PeriodTotals> {
  const [row] = await db
    .select({
      clicks: sql<number>`coalesce(sum(${schema.gscDailyMetrics.clicks}), 0)`,
      impressions: sql<number>`coalesce(sum(${schema.gscDailyMetrics.impressions}), 0)`,
      // Impression-weighted average position/CTR — a simple mean across
      // days would let a zero-impression day distort the figure.
      positionWeighted: sql<number>`coalesce(sum(${schema.gscDailyMetrics.position} * ${schema.gscDailyMetrics.impressions}), 0)`,
      rowCount: sql<number>`count(*)`,
    })
    .from(schema.gscDailyMetrics)
    .where(
      and(
        eq(schema.gscDailyMetrics.dimensionType, "site"),
        gte(schema.gscDailyMetrics.dataDate, start),
        sql`${schema.gscDailyMetrics.dataDate} <= ${end}`,
      ),
    );

  const clicks = Number(row?.clicks ?? 0);
  const impressions = Number(row?.impressions ?? 0);
  const positionWeighted = Number(row?.positionWeighted ?? 0);
  const rowCount = Number(row?.rowCount ?? 0);

  return {
    hasData: rowCount > 0,
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? positionWeighted / impressions : 0,
  };
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

async function gscTopRows(
  db: Database,
  dimensionType: "query" | "page" | "device" | "country",
  start: string,
  end: string,
  limit: number,
): Promise<TopRow[]> {
  const rows = await db
    .select({
      value: schema.gscDailyMetrics.dimensionValue,
      clicks: sql<number>`coalesce(sum(${schema.gscDailyMetrics.clicks}), 0)`,
      impressions: sql<number>`coalesce(sum(${schema.gscDailyMetrics.impressions}), 0)`,
    })
    .from(schema.gscDailyMetrics)
    .where(
      and(
        eq(schema.gscDailyMetrics.dimensionType, dimensionType),
        gte(schema.gscDailyMetrics.dataDate, start),
        sql`${schema.gscDailyMetrics.dataDate} <= ${end}`,
      ),
    )
    .groupBy(schema.gscDailyMetrics.dimensionValue)
    .orderBy(desc(sql`sum(${schema.gscDailyMetrics.clicks})`))
    .limit(limit);

  return rows.map((r) => ({
    value: r.value,
    clicks: Number(r.clicks),
    impressions: Number(r.impressions),
  }));
}

async function getGscSummary(db: Database, referenceDate: Date): Promise<GscGrowthSummary> {
  const window7 = toDateRange(referenceDate, 7);
  const window28 = toDateRange(referenceDate, 28);
  const previous28Start = new Date(`${window28.start}T00:00:00Z`);
  previous28Start.setUTCDate(previous28Start.getUTCDate() - 28);
  const previous28End = new Date(`${window28.start}T00:00:00Z`);
  previous28End.setUTCDate(previous28End.getUTCDate() - 1);

  const [
    last7Days,
    currentPeriod,
    previousPeriod,
    topQueries,
    topPages,
    devices,
    countries,
    latest,
  ] = await Promise.all([
    gscSiteTotals(db, window7.start, window7.end),
    gscSiteTotals(db, window28.start, window28.end),
    gscSiteTotals(db, isoDate(previous28Start), isoDate(previous28End)),
    gscTopRows(db, "query", window28.start, window28.end, 10),
    gscTopRows(db, "page", window28.start, window28.end, 10),
    gscTopRows(db, "device", window28.start, window28.end, 10),
    gscTopRows(db, "country", window28.start, window28.end, 5),
    db
      .select({ collectedAt: schema.gscDailyMetrics.collectedAt })
      .from(schema.gscDailyMetrics)
      .orderBy(desc(schema.gscDailyMetrics.collectedAt))
      .limit(1),
  ]);

  return {
    last7Days,
    last28Days: {
      current: currentPeriod,
      previous: previousPeriod,
      clicksDeltaPct: deltaPct(currentPeriod.clicks, previousPeriod.clicks),
      impressionsDeltaPct: deltaPct(currentPeriod.impressions, previousPeriod.impressions),
    },
    topQueries,
    topPages,
    devices,
    countries,
    lastCollectedAt: latest[0]?.collectedAt ?? null,
  };
}

async function ga4SiteTotals(db: Database, start: string, end: string): Promise<Ga4PeriodTotals> {
  const [row] = await db
    .select({
      activeUsers: sql<number>`coalesce(sum(${schema.ga4DailyMetrics.activeUsers}), 0)`,
      newUsers: sql<number>`coalesce(sum(${schema.ga4DailyMetrics.newUsers}), 0)`,
      sessions: sql<number>`coalesce(sum(${schema.ga4DailyMetrics.sessions}), 0)`,
      engagedSessions: sql<number>`coalesce(sum(${schema.ga4DailyMetrics.engagedSessions}), 0)`,
      keyEvents: sql<number>`coalesce(sum(${schema.ga4DailyMetrics.keyEvents}), 0)`,
      rowCount: sql<number>`count(*)`,
    })
    .from(schema.ga4DailyMetrics)
    .where(
      and(
        eq(schema.ga4DailyMetrics.dimensionType, "site"),
        gte(schema.ga4DailyMetrics.dataDate, start),
        sql`${schema.ga4DailyMetrics.dataDate} <= ${end}`,
      ),
    );

  return {
    hasData: Number(row?.rowCount ?? 0) > 0,
    activeUsers: Number(row?.activeUsers ?? 0),
    newUsers: Number(row?.newUsers ?? 0),
    sessions: Number(row?.sessions ?? 0),
    engagedSessions: Number(row?.engagedSessions ?? 0),
    keyEvents: Number(row?.keyEvents ?? 0),
  };
}

async function ga4TopRows(
  db: Database,
  dimensionType: "channel_group" | "landing_page",
  start: string,
  end: string,
  limit: number,
): Promise<Ga4ChannelRow[]> {
  const rows = await db
    .select({
      value: schema.ga4DailyMetrics.dimensionValue,
      activeUsers: sql<number>`coalesce(sum(${schema.ga4DailyMetrics.activeUsers}), 0)`,
      sessions: sql<number>`coalesce(sum(${schema.ga4DailyMetrics.sessions}), 0)`,
      engagedSessions: sql<number>`coalesce(sum(${schema.ga4DailyMetrics.engagedSessions}), 0)`,
    })
    .from(schema.ga4DailyMetrics)
    .where(
      and(
        eq(schema.ga4DailyMetrics.dimensionType, dimensionType),
        gte(schema.ga4DailyMetrics.dataDate, start),
        sql`${schema.ga4DailyMetrics.dataDate} <= ${end}`,
      ),
    )
    .groupBy(schema.ga4DailyMetrics.dimensionValue)
    .orderBy(desc(sql`sum(${schema.ga4DailyMetrics.sessions})`))
    .limit(limit);

  return rows.map((r) => ({
    value: r.value,
    activeUsers: Number(r.activeUsers),
    sessions: Number(r.sessions),
    engagedSessions: Number(r.engagedSessions),
  }));
}

async function getGa4Summary(db: Database, referenceDate: Date): Promise<Ga4GrowthSummary> {
  const window7 = toDateRange(referenceDate, 7);
  const window28 = toDateRange(referenceDate, 28);

  const [last7Days, channels, topLandingPages, latest] = await Promise.all([
    ga4SiteTotals(db, window7.start, window7.end),
    ga4TopRows(db, "channel_group", window28.start, window28.end, 10),
    ga4TopRows(db, "landing_page", window28.start, window28.end, 10),
    db
      .select({ collectedAt: schema.ga4DailyMetrics.collectedAt })
      .from(schema.ga4DailyMetrics)
      .orderBy(desc(schema.ga4DailyMetrics.collectedAt))
      .limit(1),
  ]);

  return { last7Days, channels, topLandingPages, lastCollectedAt: latest[0]?.collectedAt ?? null };
}

async function getCruxSummary(
  db: Database,
  origin: string | undefined,
): Promise<CruxGrowthSummary> {
  if (!origin) return { status: "no_data" };
  const [row] = await db
    .select({
      dataDate: schema.cruxSnapshots.dataDate,
      lcpP75Ms: schema.cruxSnapshots.lcpP75Ms,
      inpP75Ms: schema.cruxSnapshots.inpP75Ms,
      clsP75: schema.cruxSnapshots.clsP75,
    })
    .from(schema.cruxSnapshots)
    .where(and(eq(schema.cruxSnapshots.origin, origin), eq(schema.cruxSnapshots.formFactor, "ALL")))
    .orderBy(desc(schema.cruxSnapshots.dataDate))
    .limit(1);

  if (!row) return { status: "no_data" };
  return {
    status: "ok",
    dataDate: row.dataDate,
    lcpP75Ms: row.lcpP75Ms,
    inpP75Ms: row.inpP75Ms,
    clsP75: row.clsP75,
  };
}

/** Assembles the full Super Admin growth dashboard from persisted history —
 * every value here is a read of `gsc_daily_metrics`/`ga4_daily_metrics`/
 * `crux_snapshots`, never a live Google API call. */
export async function getGrowthDashboard(
  db: Database,
  cruxOrigin: string | undefined,
  referenceDate: Date = new Date(),
): Promise<GrowthDashboard> {
  const [gsc, ga4, crux] = await Promise.all([
    getGscSummary(db, referenceDate),
    getGa4Summary(db, referenceDate),
    getCruxSummary(db, cruxOrigin),
  ]);

  return { referenceDataDate: toDateRange(referenceDate, 1).end, gsc, ga4, crux };
}
