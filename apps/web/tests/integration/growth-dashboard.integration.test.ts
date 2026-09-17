import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { createDb } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { getGrowthDashboard } from "../../src/lib/admin/growth-dashboard";

/** Phase 1 Workstream G: the growth dashboard's SQL aggregations, exercised
 * against real D1 (not mocked Drizzle) — insert raw snapshot rows the way
 * `lib/growth/collect.ts` itself writes them, then assert on the read
 * side's rollups, deltas, and low-data states. */
describe("getGrowthDashboard (real D1)", () => {
  let dispose: () => Promise<void>;
  let rawDb: D1Database;
  let db: Database;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    rawDb = harness.db;
    db = createDb(harness.db);
  });

  afterAll(async () => {
    await dispose();
  });

  async function insertGsc(
    dataDate: string,
    dimensionType: string,
    dimensionValue: string,
    clicks: number,
    impressions: number,
    ctr: number,
    position: number,
  ) {
    await rawDb
      .prepare(
        `INSERT INTO gsc_daily_metrics (data_date, dimension_type, dimension_value, clicks, impressions, ctr, position)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(dataDate, dimensionType, dimensionValue, clicks, impressions, ctr, position)
      .run();
  }

  async function insertGa4(
    dataDate: string,
    dimensionType: string,
    dimensionValue: string,
    activeUsers: number,
    newUsers: number,
    sessions: number,
    engagedSessions: number,
    keyEvents: number,
  ) {
    await rawDb
      .prepare(
        `INSERT INTO ga4_daily_metrics (data_date, dimension_type, dimension_value, active_users, new_users, sessions, engaged_sessions, key_events)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        dataDate,
        dimensionType,
        dimensionValue,
        activeUsers,
        newUsers,
        sessions,
        engagedSessions,
        keyEvents,
      )
      .run();
  }

  it("reports no data for a fresh install", async () => {
    const dashboard = await getGrowthDashboard(
      db,
      "https://example-empty.test",
      new Date("2026-01-15T00:00:00Z"),
    );
    expect(dashboard.gsc.last7Days.hasData).toBe(false);
    expect(dashboard.gsc.last28Days.current.hasData).toBe(false);
    expect(dashboard.gsc.last28Days.clicksDeltaPct).toBeNull();
    expect(dashboard.ga4.last7Days.hasData).toBe(false);
    expect(dashboard.crux).toEqual({ status: "no_data" });
    expect(dashboard.rum).toEqual({
      lcp: { sampleSize: 0, p75: null },
      inp: { sampleSize: 0, p75: null },
      cls: { sampleSize: 0, p75: null },
    });
  });

  it("sums site totals and computes period-over-period deltas across two 28-day windows", async () => {
    // Reference date 2026-03-01 -> "yesterday" = 2026-02-28.
    // Current 28-day window: 2026-02-01..2026-02-28. Previous: 2026-01-04..2026-01-31.
    await insertGsc("2026-02-10", "site", "site", 10, 1000, 0.01, 50);
    await insertGsc("2026-02-20", "site", "site", 20, 2000, 0.01, 40);
    await insertGsc("2026-01-15", "site", "site", 10, 1000, 0.01, 60);

    const dashboard = await getGrowthDashboard(db, undefined, new Date("2026-03-01T00:00:00Z"));

    expect(dashboard.gsc.last28Days.current).toEqual({
      hasData: true,
      clicks: 30,
      impressions: 3000,
      ctr: 30 / 3000,
      position: (50 * 1000 + 40 * 2000) / 3000,
    });
    expect(dashboard.gsc.last28Days.previous).toEqual({
      hasData: true,
      clicks: 10,
      impressions: 1000,
      ctr: 0.01,
      position: 60,
    });
    // (30 - 10) / 10 * 100 = 200%
    expect(dashboard.gsc.last28Days.clicksDeltaPct).toBeCloseTo(200, 5);
    expect(dashboard.gsc.last28Days.impressionsDeltaPct).toBeCloseTo(200, 5);
  });

  it("ranks top queries/pages/devices by clicks within the window", async () => {
    const ref = new Date("2026-04-01T00:00:00Z");
    await insertGsc("2026-03-25", "query", "ai crawler checker", 50, 900, 0.05, 8);
    await insertGsc("2026-03-26", "query", "ai crawler checker", 10, 100, 0.1, 8);
    await insertGsc("2026-03-25", "query", "robots.txt validator", 5, 400, 0.01, 20);
    await insertGsc("2026-03-25", "device", "MOBILE", 40, 800, 0.05, 10);
    await insertGsc("2026-03-25", "device", "DESKTOP", 20, 400, 0.05, 10);

    const dashboard = await getGrowthDashboard(db, undefined, ref);

    expect(dashboard.gsc.topQueries[0]).toEqual({
      value: "ai crawler checker",
      clicks: 60,
      impressions: 1000,
    });
    expect(dashboard.gsc.topQueries[1]?.value).toBe("robots.txt validator");
    expect(dashboard.gsc.devices.map((d) => d.value)).toEqual(
      expect.arrayContaining(["MOBILE", "DESKTOP"]),
    );
    expect(dashboard.gsc.devices.find((d) => d.value === "MOBILE")?.clicks).toBe(40);
  });

  it("aggregates GA4 channel and landing-page breakdowns independently of GSC", async () => {
    const ref = new Date("2026-05-10T00:00:00Z");
    await insertGa4("2026-05-05", "site", "site", 9, 4, 17, 6, 1);
    await insertGa4("2026-05-05", "channel_group", "Organic Search", 6, 2, 10, 4, 1);
    await insertGa4("2026-05-05", "channel_group", "Direct", 3, 2, 7, 2, 0);
    await insertGa4("2026-05-05", "landing_page", "/tools/ai-crawler-checker", 5, 3, 8, 3, 1);

    const dashboard = await getGrowthDashboard(db, undefined, ref);

    expect(dashboard.ga4.last7Days).toEqual({
      hasData: true,
      activeUsers: 9,
      newUsers: 4,
      sessions: 17,
      engagedSessions: 6,
      keyEvents: 1,
    });
    expect(dashboard.ga4.channels[0]).toEqual({
      value: "Organic Search",
      activeUsers: 6,
      sessions: 10,
      engagedSessions: 4,
    });
    expect(dashboard.ga4.topLandingPages[0]?.value).toBe("/tools/ai-crawler-checker");
  });

  it("returns the latest CrUX snapshot for the configured origin only", async () => {
    await rawDb
      .prepare(
        `INSERT INTO crux_snapshots (data_date, origin, form_factor, lcp_p75_ms, inp_p75_ms, cls_p75)
         VALUES (?, ?, 'ALL', ?, ?, ?)`,
      )
      .bind("2026-06-01", "https://crawlpact.com", 2100, 180, 0.05)
      .run();
    await rawDb
      .prepare(
        `INSERT INTO crux_snapshots (data_date, origin, form_factor, lcp_p75_ms, inp_p75_ms, cls_p75)
         VALUES (?, ?, 'ALL', ?, ?, ?)`,
      )
      .bind("2026-06-02", "https://crawlpact.com", 1900, 150, 0.04)
      .run();
    await rawDb
      .prepare(
        `INSERT INTO crux_snapshots (data_date, origin, form_factor, lcp_p75_ms, inp_p75_ms, cls_p75)
         VALUES (?, ?, 'ALL', ?, ?, ?)`,
      )
      .bind("2026-06-05", "https://other-origin.test", 5000, 500, 0.3)
      .run();

    const dashboard = await getGrowthDashboard(
      db,
      "https://crawlpact.com",
      new Date("2026-06-10T00:00:00Z"),
    );

    expect(dashboard.crux).toEqual({
      status: "ok",
      dataDate: "2026-06-02",
      lcpP75Ms: 1900,
      inpP75Ms: 150,
      clsP75: 0.04,
    });
  });

  it("computes a p75 per RUM metric over the trailing 7 days, ignoring rows outside the window", async () => {
    const ref = new Date("2026-07-10T00:00:00Z"); // window: 2026-07-03..2026-07-09
    const lcpValues = [1000, 1200, 1400, 1600, 1800, 2000, 5000]; // p75 (ceil(7*.75)=6th smallest) = 2000
    for (const value of lcpValues) {
      await rawDb
        .prepare(
          `INSERT INTO rum_vitals (metric_name, metric_value, route, surface, device_category, recorded_at)
           VALUES ('LCP', ?, '/', 'public', 'desktop', '2026-07-05T10:00:00.000Z')`,
        )
        .bind(value)
        .run();
    }
    // Outside the 7-day window — must not affect the result.
    await rawDb
      .prepare(
        `INSERT INTO rum_vitals (metric_name, metric_value, route, surface, device_category, recorded_at)
         VALUES ('LCP', 99999, '/', 'public', 'desktop', '2026-06-01T10:00:00.000Z')`,
      )
      .run();

    const dashboard = await getGrowthDashboard(db, undefined, ref);

    expect(dashboard.rum.lcp).toEqual({ sampleSize: 7, p75: 2000 });
    expect(dashboard.rum.inp).toEqual({ sampleSize: 0, p75: null });
  });
});
