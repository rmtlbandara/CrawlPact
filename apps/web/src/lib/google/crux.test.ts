import { afterEach, describe, expect, it, vi } from "vitest";
import { queryCrux } from "./crux";

const API_KEY = "test-crux-api-key-value";
const ORIGIN = "https://crawlpact.com";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("queryCrux", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("requests the given origin and the three Core Web Vitals metrics", async () => {
    let capturedUrl = "";
    let capturedBody: Record<string, unknown> = {};
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(init?.body as string);
      return jsonResponse({ record: { metrics: {} } });
    }) as unknown as typeof fetch;

    await queryCrux({ apiKey: API_KEY, origin: ORIGIN });

    expect(capturedUrl).toBe(
      `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${API_KEY}`,
    );
    expect(capturedBody.origin).toBe(ORIGIN);
    expect(capturedBody.metrics).toEqual([
      "largest_contentful_paint",
      "interaction_to_next_paint",
      "cumulative_layout_shift",
    ]);
  });

  it("normalizes a successful response's p75 values", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        record: {
          metrics: {
            largest_contentful_paint: { percentiles: { p75: 2100 } },
            interaction_to_next_paint: { percentiles: { p75: 180 } },
            cumulative_layout_shift: { percentiles: { p75: "0.05" } },
          },
        },
      }),
    ) as unknown as typeof fetch;

    const result = await queryCrux({ apiKey: API_KEY, origin: ORIGIN });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.metrics.largestContentfulPaint).toEqual({ p75: "2100" });
      expect(result.data.metrics.interactionToNextPaint).toEqual({ p75: "180" });
      expect(result.data.metrics.cumulativeLayoutShift).toEqual({ p75: "0.05" });
    }
  });

  it("handles a metric legitimately absent from the response (insufficient per-metric data)", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        record: { metrics: { largest_contentful_paint: { percentiles: { p75: 2100 } } } },
      }),
    ) as unknown as typeof fetch;

    const result = await queryCrux({ apiKey: API_KEY, origin: ORIGIN });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.metrics.largestContentfulPaint).toEqual({ p75: "2100" });
      expect(result.data.metrics.interactionToNextPaint).toBeNull();
    }
  });

  it("represents a 200 response with no usable record as no_data, not a fabricated ok", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ record: { metrics: {} } }),
    ) as unknown as typeof fetch;

    const result = await queryCrux({ apiKey: API_KEY, origin: ORIGIN });
    expect(result).toEqual({ status: "no_data" });
  });

  it("represents a 200 response missing the record field entirely as no_data", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({})) as unknown as typeof fetch;

    const result = await queryCrux({ apiKey: API_KEY, origin: ORIGIN });
    expect(result).toEqual({ status: "no_data" });
  });

  it("represents a legitimate 404 (no CrUX data for the origin) as no_data, not a failure", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ error: { code: 404, message: "record not found", status: "NOT_FOUND" } }, 404),
    ) as unknown as typeof fetch;

    const result = await queryCrux({ apiKey: API_KEY, origin: ORIGIN });
    expect(result).toEqual({ status: "no_data" });
  });

  it("maps an invalid/restricted API key response to a failure, not no_data", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ error: { code: 403, message: "API key not valid" } }, 403),
    ) as unknown as typeof fetch;

    const result = await queryCrux({ apiKey: API_KEY, origin: ORIGIN });
    expect(result).toEqual({ status: "permission_denied" });
  });

  it("maps a thrown network/upstream error to upstream_unavailable", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("connection reset");
    }) as unknown as typeof fetch;

    const result = await queryCrux({ apiKey: API_KEY, origin: ORIGIN });
    expect(result).toEqual({ status: "upstream_unavailable" });
  });

  it("never includes the API key in a thrown/returned error", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("connection reset");
    }) as unknown as typeof fetch;

    const result = await queryCrux({ apiKey: API_KEY, origin: ORIGIN });
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });
});
