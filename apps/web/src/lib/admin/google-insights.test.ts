import { beforeEach, describe, expect, it, vi } from "vitest";

const getGoogleAccessTokenMock = vi.fn();
vi.mock("../google/service-account", () => ({
  GOOGLE_SEARCH_CONSOLE_READONLY_SCOPE: "https://www.googleapis.com/auth/webmasters.readonly",
  GOOGLE_ANALYTICS_READONLY_SCOPE: "https://www.googleapis.com/auth/analytics.readonly",
  getGoogleAccessToken: getGoogleAccessTokenMock,
}));

const querySearchConsoleMock = vi.fn();
vi.mock("../google/search-console", () => ({ querySearchConsole: querySearchConsoleMock }));

const queryGa4ReportMock = vi.fn();
vi.mock("../google/ga4", () => ({ queryGa4Report: queryGa4ReportMock }));

const queryCruxMock = vi.fn();
vi.mock("../google/crux", () => ({ queryCrux: queryCruxMock }));

const { getGoogleInsightsSnapshot } = await import("./google-insights");

const CONFIG = {
  serviceAccountJson: '{"client_email":"x","private_key":"y"}',
  ga4PropertyId: "547512440",
  searchConsoleSiteUrl: "sc-domain:crawlpact.com",
  cruxApiKey: "test-key",
  cruxOrigin: "https://crawlpact.com",
};

describe("getGoogleInsightsSnapshot", () => {
  beforeEach(() => {
    getGoogleAccessTokenMock.mockReset();
    querySearchConsoleMock.mockReset();
    queryGa4ReportMock.mockReset();
    queryCruxMock.mockReset();
  });

  it("reports not_configured per service when every value is absent, without exchanging a token", async () => {
    const snapshot = await getGoogleInsightsSnapshot({
      serviceAccountJson: undefined,
      ga4PropertyId: undefined,
      searchConsoleSiteUrl: undefined,
      cruxApiKey: undefined,
      cruxOrigin: undefined,
    });

    expect(snapshot).toEqual({
      searchConsole: { status: "not_configured" },
      ga4: { status: "not_configured" },
      crux: { status: "not_configured" },
    });
    expect(getGoogleAccessTokenMock).not.toHaveBeenCalled();
  });

  it("reports crux not_configured independently when only the API key is missing", async () => {
    getGoogleAccessTokenMock.mockResolvedValue({
      ok: true,
      accessToken: "tok",
      expiresAt: Date.now() + 1000,
    });
    querySearchConsoleMock.mockResolvedValue({ status: "ok", data: { rowCount: 0, rows: [] } });
    queryGa4ReportMock.mockResolvedValue({
      status: "ok",
      data: { rowCount: 0, rows: [], totals: { activeUsers: 0, sessions: 0 } },
    });

    const snapshot = await getGoogleInsightsSnapshot({ ...CONFIG, cruxApiKey: undefined });
    expect(snapshot.crux).toEqual({ status: "not_configured" });
    expect(queryCruxMock).not.toHaveBeenCalled();
  });

  it("requests one shared token with both read-only scopes for search console + GA4", async () => {
    getGoogleAccessTokenMock.mockResolvedValue({
      ok: true,
      accessToken: "shared-token",
      expiresAt: Date.now() + 1000,
    });
    querySearchConsoleMock.mockResolvedValue({ status: "ok", data: { rowCount: 0, rows: [] } });
    queryGa4ReportMock.mockResolvedValue({
      status: "ok",
      data: { rowCount: 0, rows: [], totals: { activeUsers: 0, sessions: 0 } },
    });
    queryCruxMock.mockResolvedValue({ status: "no_data" });

    await getGoogleInsightsSnapshot(CONFIG);

    expect(getGoogleAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(getGoogleAccessTokenMock).toHaveBeenCalledWith(CONFIG.serviceAccountJson, [
      "https://www.googleapis.com/auth/webmasters.readonly",
      "https://www.googleapis.com/auth/analytics.readonly",
    ]);
    expect(querySearchConsoleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "shared-token",
        siteUrl: CONFIG.searchConsoleSiteUrl,
      }),
    );
    expect(queryGa4ReportMock).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "shared-token", propertyId: CONFIG.ga4PropertyId }),
    );
  });

  it("propagates a token exchange failure to both search console and GA4, but not CrUX", async () => {
    getGoogleAccessTokenMock.mockResolvedValue({ ok: false, reason: "token_exchange_failed" });
    queryCruxMock.mockResolvedValue({ status: "ok", data: { metrics: {} } });

    const snapshot = await getGoogleInsightsSnapshot(CONFIG);

    expect(snapshot.searchConsole).toEqual({ status: "token_exchange_failed" });
    expect(snapshot.ga4).toEqual({ status: "token_exchange_failed" });
    expect(querySearchConsoleMock).not.toHaveBeenCalled();
    expect(queryGa4ReportMock).not.toHaveBeenCalled();
    expect(snapshot.crux.status).toBe("ok");
  });

  it("returns a full successful snapshot with sanitized sample data", async () => {
    getGoogleAccessTokenMock.mockResolvedValue({
      ok: true,
      accessToken: "tok",
      expiresAt: Date.now() + 1000,
    });
    querySearchConsoleMock.mockResolvedValue({
      status: "ok",
      data: {
        rowCount: 1,
        rows: [
          { keys: ["crawler compliance"], clicks: 5, impressions: 100, ctr: 0.05, position: 4.2 },
        ],
      },
    });
    queryGa4ReportMock.mockResolvedValue({
      status: "ok",
      data: {
        rowCount: 1,
        rows: [{ date: "20260901", activeUsers: 10, sessions: 12 }],
        totals: { activeUsers: 10, sessions: 12 },
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

    const snapshot = await getGoogleInsightsSnapshot(CONFIG);

    expect(snapshot.searchConsole).toEqual({
      status: "ok",
      rowCount: 1,
      topRows: [{ keys: ["crawler compliance"], clicks: 5, impressions: 100 }],
    });
    expect(snapshot.ga4).toEqual({
      status: "ok",
      rowCount: 1,
      totals: { activeUsers: 10, sessions: 12 },
    });
    expect(snapshot.crux.status).toBe("ok");
  });

  it("never includes a token, credential, or API key anywhere in the returned snapshot", async () => {
    getGoogleAccessTokenMock.mockResolvedValue({
      ok: true,
      accessToken: "super-secret-token",
      expiresAt: Date.now() + 1000,
    });
    querySearchConsoleMock.mockResolvedValue({ status: "ok", data: { rowCount: 0, rows: [] } });
    queryGa4ReportMock.mockResolvedValue({
      status: "ok",
      data: { rowCount: 0, rows: [], totals: { activeUsers: 0, sessions: 0 } },
    });
    queryCruxMock.mockResolvedValue({ status: "no_data" });

    const snapshot = await getGoogleInsightsSnapshot(CONFIG);
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain("super-secret-token");
    expect(serialized).not.toContain(CONFIG.cruxApiKey);
    expect(serialized).not.toContain(CONFIG.serviceAccountJson);
  });
});
