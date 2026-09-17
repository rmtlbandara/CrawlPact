import { beforeEach, describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";

const getGoogleAccessTokenMock = vi.fn();
vi.mock("../google/service-account", () => ({
  GOOGLE_SEARCH_CONSOLE_READONLY_SCOPE: "https://www.googleapis.com/auth/webmasters.readonly",
  GOOGLE_ANALYTICS_READONLY_SCOPE: "https://www.googleapis.com/auth/analytics.readonly",
  getGoogleAccessToken: getGoogleAccessTokenMock,
}));

const querySearchConsoleMock = vi.fn();
vi.mock("../google/search-console", () => ({ querySearchConsole: querySearchConsoleMock }));

const queryGa4DimensionedReportMock = vi.fn();
vi.mock("../google/ga4", () => ({ queryGa4DimensionedReport: queryGa4DimensionedReportMock }));

const queryCruxMock = vi.fn();
vi.mock("../google/crux", () => ({ queryCrux: queryCruxMock }));

const { collectGrowthSnapshots } = await import("./collect");

const CONFIG = {
  serviceAccountJson: '{"client_email":"x","private_key":"y"}',
  ga4PropertyId: "547512440",
  searchConsoleSiteUrl: "sc-domain:crawlpact.com",
  cruxApiKey: "test-key",
  cruxOrigin: "https://crawlpact.com",
};

// 2026-09-17 UTC — every test asserts against "yesterday" (2026-09-16) so
// the reference date is fixed rather than depending on when the suite runs.
const REFERENCE_DATE = new Date("2026-09-17T04:00:00.000Z");

function createFakeD1(): { db: D1Database; calls: Array<{ sql: string; params: unknown[] }> } {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async run() {
              calls.push({ sql, params });
              return { success: true, meta: {} };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  return { db, calls };
}

function tableOf(sql: string): string {
  const match = /INSERT INTO (\w+)/.exec(sql);
  if (!match) throw new Error(`no INSERT INTO in: ${sql}`);
  return match[1];
}

describe("collectGrowthSnapshots", () => {
  beforeEach(() => {
    getGoogleAccessTokenMock.mockReset();
    querySearchConsoleMock.mockReset();
    queryGa4DimensionedReportMock.mockReset();
    queryCruxMock.mockReset();
  });

  it("reports not_configured per provider when every value is absent, without exchanging a token", async () => {
    const { db, calls } = createFakeD1();
    const summary = await collectGrowthSnapshots(
      db,
      {
        serviceAccountJson: undefined,
        ga4PropertyId: undefined,
        searchConsoleSiteUrl: undefined,
        cruxApiKey: undefined,
        cruxOrigin: undefined,
      },
      REFERENCE_DATE,
    );

    expect(summary.dataDate).toBe("2026-09-16");
    expect(summary.searchConsole).toEqual({ status: "not_configured" });
    expect(summary.ga4).toEqual({ status: "not_configured" });
    expect(summary.crux).toEqual({ status: "not_configured" });
    expect(getGoogleAccessTokenMock).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it("collects and upserts all three providers on a fully successful run", async () => {
    getGoogleAccessTokenMock.mockResolvedValue({
      ok: true,
      accessToken: "tok",
      expiresAt: Date.now() + 60_000,
    });
    // One row per dimension set, keyed by [date, dimensionValue] (or just
    // [date] for the "site" set with no second dimension).
    querySearchConsoleMock.mockImplementation(async ({ dimensions }: { dimensions: string[] }) => ({
      status: "ok",
      data: {
        rowCount: 1,
        rows: [
          {
            keys: dimensions.length === 1 ? ["2026-09-16"] : ["2026-09-16", "example-value"],
            clicks: 3,
            impressions: 888,
            ctr: 0.00338,
            position: 61.56,
          },
        ],
      },
    }));
    queryGa4DimensionedReportMock.mockResolvedValue({
      status: "ok",
      data: {
        rowCount: 1,
        rows: [
          {
            dimensionValue: "Organic Search",
            activeUsers: 9,
            newUsers: 4,
            sessions: 17,
            engagedSessions: 6,
            keyEvents: 1,
          },
        ],
      },
    });
    queryCruxMock.mockResolvedValue({
      status: "ok",
      data: {
        metrics: {
          largestContentfulPaint: { p75: "2100" },
          interactionToNextPaint: { p75: "180" },
          cumulativeLayoutShift: { p75: "0.05" },
        },
      },
    });

    const { db, calls } = createFakeD1();
    const summary = await collectGrowthSnapshots(db, CONFIG, REFERENCE_DATE);

    expect(summary.searchConsole).toEqual({ status: "ok", rowsWritten: 5 }); // site, query, page, device, country
    expect(summary.ga4).toEqual({ status: "ok", rowsWritten: 4 }); // site, channel_group, landing_page, device
    expect(summary.crux).toEqual({ status: "ok", rowsWritten: 1 });

    expect(getGoogleAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(getGoogleAccessTokenMock).toHaveBeenCalledWith(CONFIG.serviceAccountJson, [
      "https://www.googleapis.com/auth/webmasters.readonly",
      "https://www.googleapis.com/auth/analytics.readonly",
    ]);

    const gscCalls = calls.filter((c) => tableOf(c.sql) === "gsc_daily_metrics");
    const ga4Calls = calls.filter((c) => tableOf(c.sql) === "ga4_daily_metrics");
    const cruxCalls = calls.filter((c) => tableOf(c.sql) === "crux_snapshots");
    expect(gscCalls).toHaveLength(5);
    expect(ga4Calls).toHaveLength(4);
    expect(cruxCalls).toHaveLength(1);

    // Spot-check one GSC row's bound params: (data_date, dimension_type,
    // dimension_value, clicks, impressions, ctr, position).
    const queryRow = gscCalls.find((c) => c.params[1] === "query");
    expect(queryRow?.params).toEqual([
      "2026-09-16",
      "query",
      "example-value",
      3,
      888,
      0.00338,
      61.56,
    ]);

    const siteRow = gscCalls.find((c) => c.params[1] === "site");
    expect(siteRow?.params[2]).toBe("site");

    expect(cruxCalls[0]?.params).toEqual(["2026-09-16", "https://crawlpact.com", 2100, 180, 0.05]);
  });

  it("isolates a GA4 misconfiguration from GSC and CrUX succeeding", async () => {
    getGoogleAccessTokenMock.mockResolvedValue({
      ok: true,
      accessToken: "tok",
      expiresAt: Date.now() + 60_000,
    });
    querySearchConsoleMock.mockResolvedValue({ status: "ok", data: { rowCount: 0, rows: [] } });
    queryCruxMock.mockResolvedValue({ status: "no_data" });

    const { db } = createFakeD1();
    const summary = await collectGrowthSnapshots(
      db,
      { ...CONFIG, ga4PropertyId: undefined },
      REFERENCE_DATE,
    );

    expect(summary.ga4).toEqual({ status: "not_configured" });
    expect(summary.searchConsole).toEqual({ status: "ok", rowsWritten: 0 });
    expect(summary.crux).toEqual({ status: "no_data" });
    expect(queryGa4DimensionedReportMock).not.toHaveBeenCalled();
  });

  it("still reports ok with a partial row count when only some GSC dimension calls fail", async () => {
    getGoogleAccessTokenMock.mockResolvedValue({
      ok: true,
      accessToken: "tok",
      expiresAt: Date.now() + 60_000,
    });
    querySearchConsoleMock.mockImplementation(async ({ dimensions }: { dimensions: string[] }) => {
      if (dimensions.includes("device")) return { status: "permission_denied" };
      return {
        status: "ok",
        data: {
          rowCount: 1,
          rows: [
            {
              keys: dimensions.length === 1 ? ["2026-09-16"] : ["2026-09-16", "v"],
              clicks: 1,
              impressions: 10,
              ctr: 0.1,
              position: 5,
            },
          ],
        },
      };
    });
    queryGa4DimensionedReportMock.mockResolvedValue({
      status: "ok",
      data: { rowCount: 0, rows: [] },
    });
    queryCruxMock.mockResolvedValue({ status: "not_configured" });

    const { db } = createFakeD1();
    const summary = await collectGrowthSnapshots(db, CONFIG, REFERENCE_DATE);

    // 5 dimension sets, one (device) fails outright — the other 4 each
    // contribute exactly one row.
    expect(summary.searchConsole).toEqual({ status: "ok", rowsWritten: 4 });
  });

  it("reports a provider's failure reason only when every dimension call for it fails", async () => {
    getGoogleAccessTokenMock.mockResolvedValue({
      ok: true,
      accessToken: "tok",
      expiresAt: Date.now() + 60_000,
    });
    querySearchConsoleMock.mockResolvedValue({ status: "rate_limited" });
    queryGa4DimensionedReportMock.mockResolvedValue({
      status: "ok",
      data: { rowCount: 0, rows: [] },
    });
    queryCruxMock.mockResolvedValue({ status: "not_configured" });

    const { db } = createFakeD1();
    const summary = await collectGrowthSnapshots(db, CONFIG, REFERENCE_DATE);

    expect(summary.searchConsole).toEqual({ status: "rate_limited" });
  });

  it("propagates a token-exchange failure to both GSC and GA4 without calling either provider", async () => {
    getGoogleAccessTokenMock.mockResolvedValue({ ok: false, reason: "invalid_credential_json" });
    queryCruxMock.mockResolvedValue({ status: "ok", data: { metrics: {} } });

    const { db } = createFakeD1();
    const summary = await collectGrowthSnapshots(db, CONFIG, REFERENCE_DATE);

    expect(summary.searchConsole).toEqual({ status: "invalid_credential_json" });
    expect(summary.ga4).toEqual({ status: "invalid_credential_json" });
    expect(querySearchConsoleMock).not.toHaveBeenCalled();
    expect(queryGa4DimensionedReportMock).not.toHaveBeenCalled();
  });

  it("respects a custom gscWindowDays option when computing the query window", async () => {
    getGoogleAccessTokenMock.mockResolvedValue({
      ok: true,
      accessToken: "tok",
      expiresAt: Date.now() + 60_000,
    });
    let capturedStartDate = "";
    querySearchConsoleMock.mockImplementation(async ({ startDate }: { startDate: string }) => {
      capturedStartDate = startDate;
      return { status: "ok", data: { rowCount: 0, rows: [] } };
    });
    queryGa4DimensionedReportMock.mockResolvedValue({
      status: "ok",
      data: { rowCount: 0, rows: [] },
    });
    queryCruxMock.mockResolvedValue({ status: "not_configured" });

    const { db } = createFakeD1();
    await collectGrowthSnapshots(db, { ...CONFIG, cruxApiKey: undefined }, REFERENCE_DATE, {
      gscWindowDays: 28,
    });

    // endDate is 2026-09-16 (yesterday); a 28-day window starts 27 days
    // before that.
    expect(capturedStartDate).toBe("2026-08-20");
  });
});
