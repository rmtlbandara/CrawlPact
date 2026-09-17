import { describe, expect, it, vi } from "vitest";
import { isValidMetricValue, normalizeRumRoute, recordRumMetrics } from "./rum";

describe("normalizeRumRoute", () => {
  it("passes through exact known routes unchanged", () => {
    expect(normalizeRumRoute("/")).toBe("/");
    expect(normalizeRumRoute("/pricing/")).toBe("/pricing/");
    expect(normalizeRumRoute("/admin/growth")).toBe("/admin/growth");
  });

  it("collapses a dynamic crawler/guide/platform slug to its template", () => {
    expect(normalizeRumRoute("/crawlers/gptbot/")).toBe("/crawlers/:slug/");
    expect(normalizeRumRoute("/guides/wordpress/")).toBe("/guides/:slug/");
    expect(normalizeRumRoute("/platforms/vercel/")).toBe("/platforms/:slug/");
    expect(normalizeRumRoute("/for/agencies/")).toBe("/for/:slug/");
  });

  it("collapses arbitrary app/admin sub-paths without leaking the raw value", () => {
    expect(normalizeRumRoute("/app/domains/dom_12345")).toBe("/app/:section/");
    expect(normalizeRumRoute("/admin/users/usr_98765")).toBe("/admin/:section/");
  });

  it("strips query strings and fragments before matching", () => {
    expect(normalizeRumRoute("/pricing/?utm_source=evil&token=abc123")).toBe("/pricing/");
    expect(normalizeRumRoute("/crawlers/gptbot/#section")).toBe("/crawlers/:slug/");
  });

  it("falls back to 'other' for anything unrecognized, never storing the raw path", () => {
    expect(normalizeRumRoute("/some/random/unmapped/path?ssn=123-45-6789")).toBe("other");
  });
});

describe("isValidMetricValue", () => {
  it("accepts sane values within bounds", () => {
    expect(isValidMetricValue("LCP", 2500)).toBe(true);
    expect(isValidMetricValue("CLS", 0.05)).toBe(true);
  });

  it("rejects negative, non-finite, and absurdly large values", () => {
    expect(isValidMetricValue("LCP", -1)).toBe(false);
    expect(isValidMetricValue("LCP", Number.NaN)).toBe(false);
    expect(isValidMetricValue("LCP", Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidMetricValue("LCP", 999_999)).toBe(false);
    expect(isValidMetricValue("CLS", 1000)).toBe(false);
  });
});

describe("recordRumMetrics", () => {
  function fakeDb() {
    const inserted: unknown[] = [];
    return {
      db: {
        insert: () => ({
          values: async (rows: unknown[]) => {
            inserted.push(...rows);
          },
        }),
      } as never,
      inserted,
    };
  }

  it("writes one row per valid metric, normalizing the route and stamping surface/device", async () => {
    const { db, inserted } = fakeDb();
    const written = await recordRumMetrics(db, {
      route: "/crawlers/gptbot/?x=1",
      surface: "public",
      deviceCategory: "mobile",
      metrics: [
        { name: "LCP", value: 2100, rating: "good" },
        { name: "CLS", value: 0.02 },
      ],
    });

    expect(written).toBe(2);
    expect(inserted).toEqual([
      expect.objectContaining({
        metricName: "LCP",
        metricValue: 2100,
        rating: "good",
        route: "/crawlers/:slug/",
        surface: "public",
        deviceCategory: "mobile",
      }),
      expect.objectContaining({
        metricName: "CLS",
        metricValue: 0.02,
        rating: null,
        route: "/crawlers/:slug/",
      }),
    ]);
  });

  it("silently drops an out-of-range metric without failing the whole batch", async () => {
    const { db, inserted } = fakeDb();
    const written = await recordRumMetrics(db, {
      route: "/",
      surface: "app",
      deviceCategory: "desktop",
      metrics: [
        { name: "LCP", value: -5 },
        { name: "INP", value: 180 },
      ],
    });

    expect(written).toBe(1);
    expect(inserted).toHaveLength(1);
    expect((inserted[0] as { metricName: string }).metricName).toBe("INP");
  });

  it("writes nothing and skips the insert call when every metric is invalid", async () => {
    const insertSpy = vi.fn();
    const db = { insert: insertSpy } as never;
    const written = await recordRumMetrics(db, {
      route: "/",
      surface: "public",
      deviceCategory: "desktop",
      metrics: [{ name: "CLS", value: -1 }],
    });

    expect(written).toBe(0);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
