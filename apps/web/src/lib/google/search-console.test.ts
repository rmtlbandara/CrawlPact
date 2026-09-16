import { afterEach, describe, expect, it, vi } from "vitest";
import { querySearchConsole } from "./search-console";

const ACCESS_TOKEN = "test-access-token";
const SITE_URL = "sc-domain:crawlpact.com";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("querySearchConsole", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("correctly encodes a domain property in the request URL", async () => {
    let capturedUrl = "";
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      capturedUrl = String(url);
      return jsonResponse({ rows: [] });
    }) as unknown as typeof fetch;

    await querySearchConsole({
      siteUrl: SITE_URL,
      accessToken: ACCESS_TOKEN,
      startDate: "2026-08-01",
      endDate: "2026-08-28",
    });

    expect(capturedUrl).toBe(
      "https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Acrawlpact.com/searchAnalytics/query",
    );
  });

  it("adds the Authorization header internally", async () => {
    let capturedHeaders: Record<string, string> = {};
    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = init?.headers as Record<string, string>;
      return jsonResponse({ rows: [] });
    }) as unknown as typeof fetch;

    await querySearchConsole({
      siteUrl: SITE_URL,
      accessToken: ACCESS_TOKEN,
      startDate: "2026-08-01",
      endDate: "2026-08-28",
    });

    expect(capturedHeaders.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
    expect(capturedHeaders["Content-Type"]).toBe("application/json");
  });

  it("normalizes a successful response with rows", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        rows: [
          { keys: ["crawler compliance"], clicks: 12, impressions: 340, ctr: 0.035, position: 8.2 },
          { keys: ["robots.txt checker"], clicks: 4, impressions: 90, ctr: 0.044, position: 11.1 },
        ],
      }),
    ) as unknown as typeof fetch;

    const result = await querySearchConsole({
      siteUrl: SITE_URL,
      accessToken: ACCESS_TOKEN,
      startDate: "2026-08-01",
      endDate: "2026-08-28",
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.rowCount).toBe(2);
      expect(result.data.rows[0]).toEqual({
        keys: ["crawler compliance"],
        clicks: 12,
        impressions: 340,
        ctr: 0.035,
        position: 8.2,
      });
    }
  });

  it("treats an empty row set as a normal success, not a failure", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({})) as unknown as typeof fetch;

    const result = await querySearchConsole({
      siteUrl: SITE_URL,
      accessToken: ACCESS_TOKEN,
      startDate: "2026-08-01",
      endDate: "2026-08-28",
    });

    expect(result).toEqual({ status: "ok", data: { rowCount: 0, rows: [] } });
  });

  it("maps a 401 to auth_failed", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ error: "invalid token" }, 401),
    ) as unknown as typeof fetch;
    const result = await querySearchConsole({
      siteUrl: SITE_URL,
      accessToken: ACCESS_TOKEN,
      startDate: "2026-08-01",
      endDate: "2026-08-28",
    });
    expect(result).toEqual({ status: "auth_failed" });
  });

  it("maps a 403 to permission_denied", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ error: "forbidden" }, 403),
    ) as unknown as typeof fetch;
    const result = await querySearchConsole({
      siteUrl: SITE_URL,
      accessToken: ACCESS_TOKEN,
      startDate: "2026-08-01",
      endDate: "2026-08-28",
    });
    expect(result).toEqual({ status: "permission_denied" });
  });

  it("maps a 5xx to upstream_unavailable", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({}, 503)) as unknown as typeof fetch;
    const result = await querySearchConsole({
      siteUrl: SITE_URL,
      accessToken: ACCESS_TOKEN,
      startDate: "2026-08-01",
      endDate: "2026-08-28",
    });
    expect(result).toEqual({ status: "upstream_unavailable" });
  });

  it("maps a thrown network error to upstream_unavailable", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("connection reset");
    }) as unknown as typeof fetch;
    const result = await querySearchConsole({
      siteUrl: SITE_URL,
      accessToken: ACCESS_TOKEN,
      startDate: "2026-08-01",
      endDate: "2026-08-28",
    });
    expect(result).toEqual({ status: "upstream_unavailable" });
  });
});
