import { afterEach, describe, expect, it, vi } from "vitest";
import { queryGa4DimensionedReport, queryGa4Report } from "./ga4";

const ACCESS_TOKEN = "test-access-token";
const PROPERTY_ID = "547512440";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("queryGa4Report", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("calls the correct v1beta runReport endpoint with the property ID", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedHeaders = init?.headers as Record<string, string>;
      return jsonResponse({ rows: [] });
    }) as unknown as typeof fetch;

    await queryGa4Report({
      propertyId: PROPERTY_ID,
      accessToken: ACCESS_TOKEN,
      startDate: "7daysAgo",
      endDate: "yesterday",
    });

    expect(capturedUrl).toBe(
      `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`,
    );
    expect(capturedHeaders.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
  });

  it("normalizes a successful report with rows, summing totals", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        rowCount: 2,
        rows: [
          {
            dimensionValues: [{ value: "20260901" }],
            metricValues: [{ value: "10" }, { value: "14" }],
          },
          {
            dimensionValues: [{ value: "20260902" }],
            metricValues: [{ value: "8" }, { value: "9" }],
          },
        ],
      }),
    ) as unknown as typeof fetch;

    const result = await queryGa4Report({
      propertyId: PROPERTY_ID,
      accessToken: ACCESS_TOKEN,
      startDate: "7daysAgo",
      endDate: "yesterday",
      includeDateDimension: true,
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.rowCount).toBe(2);
      expect(result.data.rows[0]).toEqual({ date: "20260901", activeUsers: 10, sessions: 14 });
      expect(result.data.totals).toEqual({ activeUsers: 18, sessions: 23 });
    }
  });

  it("treats an empty row set as a normal success, not a failure", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({})) as unknown as typeof fetch;

    const result = await queryGa4Report({
      propertyId: PROPERTY_ID,
      accessToken: ACCESS_TOKEN,
      startDate: "7daysAgo",
      endDate: "yesterday",
    });

    expect(result).toEqual({
      status: "ok",
      data: { rowCount: 0, rows: [], totals: { activeUsers: 0, sessions: 0 } },
    });
  });

  it("maps a 403 permission failure", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ error: "forbidden" }, 403),
    ) as unknown as typeof fetch;
    const result = await queryGa4Report({
      propertyId: PROPERTY_ID,
      accessToken: ACCESS_TOKEN,
      startDate: "7daysAgo",
      endDate: "yesterday",
    });
    expect(result).toEqual({ status: "permission_denied" });
  });

  it("maps a thrown network error to upstream_unavailable", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("connection reset");
    }) as unknown as typeof fetch;
    const result = await queryGa4Report({
      propertyId: PROPERTY_ID,
      accessToken: ACCESS_TOKEN,
      startDate: "7daysAgo",
      endDate: "yesterday",
    });
    expect(result).toEqual({ status: "upstream_unavailable" });
  });
});

describe("queryGa4DimensionedReport", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("requests the five growth-collection metrics with no dimension for a null breakdown", async () => {
    let capturedBody: Record<string, unknown> = {};
    globalThis.fetch = vi.fn(async (_url, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return jsonResponse({ rows: [] });
    }) as unknown as typeof fetch;

    await queryGa4DimensionedReport({
      propertyId: PROPERTY_ID,
      accessToken: ACCESS_TOKEN,
      startDate: "2026-09-16",
      endDate: "2026-09-16",
      dimension: null,
    });

    expect(capturedBody.dimensions).toEqual([]);
    expect(capturedBody.metrics).toEqual([
      { name: "activeUsers" },
      { name: "newUsers" },
      { name: "sessions" },
      { name: "engagedSessions" },
      { name: "keyEvents" },
    ]);
  });

  it("normalizes rows keyed by the requested dimension", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        rows: [
          {
            dimensionValues: [{ value: "Organic Search" }],
            metricValues: [
              { value: "9" },
              { value: "4" },
              { value: "17" },
              { value: "6" },
              { value: "1" },
            ],
          },
        ],
      }),
    ) as unknown as typeof fetch;

    const result = await queryGa4DimensionedReport({
      propertyId: PROPERTY_ID,
      accessToken: ACCESS_TOKEN,
      startDate: "2026-09-16",
      endDate: "2026-09-16",
      dimension: "sessionDefaultChannelGroup",
    });

    expect(result).toEqual({
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
  });

  it("labels a null-dimension row 'site' regardless of what the API returns", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        rows: [
          {
            dimensionValues: [],
            metricValues: [
              { value: "9" },
              { value: "4" },
              { value: "17" },
              { value: "6" },
              { value: "1" },
            ],
          },
        ],
      }),
    ) as unknown as typeof fetch;

    const result = await queryGa4DimensionedReport({
      propertyId: PROPERTY_ID,
      accessToken: ACCESS_TOKEN,
      startDate: "2026-09-16",
      endDate: "2026-09-16",
      dimension: null,
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.rows[0]?.dimensionValue).toBe("site");
    }
  });

  it("maps a 429 to rate_limited", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({}, 429)) as unknown as typeof fetch;
    const result = await queryGa4DimensionedReport({
      propertyId: PROPERTY_ID,
      accessToken: ACCESS_TOKEN,
      startDate: "2026-09-16",
      endDate: "2026-09-16",
      dimension: "landingPage",
    });
    expect(result).toEqual({ status: "rate_limited" });
  });
});
