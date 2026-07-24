import { afterEach, describe, expect, it, vi } from "vitest";
import { runScan } from "./orchestrator";
import type { DnsResolver } from "./dns-resolve";

const publicResolver: DnsResolver = async () => ({ ok: true, addresses: ["93.184.216.34"] });

function makeResponse(
  status: number,
  body: string,
  headers: Record<string, string> = {},
): Response {
  return new Response(body, { status, headers });
}

describe("runScan", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("fetches and parses robots.txt, sitemap, llms.txt, llms-full.txt, homepage, and RSL", async () => {
    const requestedUrls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url.endsWith("/robots.txt")) {
        return makeResponse(
          200,
          "User-agent: *\nDisallow: /admin\nSitemap: https://example.com/sitemap.xml\n",
        );
      }
      if (url.endsWith("/sitemap.xml")) {
        return makeResponse(200, "<urlset><url><loc>https://example.com/a</loc></url></urlset>", {
          "content-type": "application/xml",
        });
      }
      if (url.endsWith("/llms-full.txt")) {
        return makeResponse(200, "# Example (full)\n[Docs](https://example.com/docs)\n");
      }
      if (url.endsWith("/llms.txt")) {
        return makeResponse(200, "# Example\n");
      }
      if (url.endsWith("/.well-known/rsl.xml")) {
        return makeResponse(404, "");
      }
      return makeResponse(200, '<html><head><meta name="robots" content="noindex"></head></html>', {
        "x-robots-tag": "noindex",
      });
    }) as unknown as typeof fetch;

    const result = await runScan("https://example.com", { resolver: publicResolver });

    expect(result.robotsTxt.parsed?.groups[0]?.rules).toHaveLength(1);
    expect(result.sitemap.parsed?.sampledUrls).toEqual(["https://example.com/a"]);
    expect(result.llmsTxt.parsed?.hasH1Heading).toBe(true);
    expect(result.llmsFullTxt.parsed?.hasH1Heading).toBe(true);
    expect(result.llmsFullTxt.parsed?.linkedResources).toEqual(["https://example.com/docs"]);
    expect(result.homepage.parsed?.metaRobots).toBe("noindex");
    expect(result.xRobotsTag).toEqual(["noindex"]);
    // A 404 is still a completed fetch (ok:true, statusCode 404) — the RSL
    // parser correctly reports "not discovered" for the empty body rather
    // than the orchestrator treating a 404 as a fetch failure.
    expect(result.rsl.parsed?.discovered).toBe(false);
    expect(requestedUrls).toContain("https://example.com/sitemap.xml");
    expect(result.externalRequestCount).toBe(6);
  });

  it("discovers the sitemap URL declared in robots.txt rather than always guessing /sitemap.xml", async () => {
    const requestedUrls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url.endsWith("/robots.txt")) {
        return makeResponse(
          200,
          "Sitemap: https://example.com/custom-sitemap.xml\nUser-agent: *\nAllow: /\n",
        );
      }
      return makeResponse(200, "ok");
    }) as unknown as typeof fetch;

    await runScan("https://example.com", { resolver: publicResolver });
    expect(requestedUrls).toContain("https://example.com/custom-sitemap.xml");
    expect(requestedUrls).not.toContain("https://example.com/sitemap.xml");
  });

  it("never exceeds the external request budget", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      return makeResponse(200, "ok");
    }) as unknown as typeof fetch;

    const result = await runScan("https://example.com", { resolver: publicResolver });
    expect(calls).toBeLessThanOrEqual(12);
    expect(result.externalRequestCount).toBeLessThanOrEqual(12);
  });

  it("stops attempting further resources once the total-scan timeout budget is exhausted", async () => {
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    globalThis.fetch = vi.fn(async () => {
      // Simulate the first resource fetch alone taking longer than the
      // entire total-scan budget (FR-FET-007) — without total-scan
      // enforcement, four more sequential per-resource fetches would still
      // be attempted after this.
      now += 40_000;
      return makeResponse(200, "ok");
    }) as unknown as typeof fetch;

    const result = await runScan("https://example.com", {
      resolver: publicResolver,
      totalTimeoutMs: 30_000,
    });

    expect(result.robotsTxt.attempted).toBe(true);
    expect(result.sitemap.attempted).toBe(false);
    expect(result.llmsTxt.attempted).toBe(false);
    expect(result.llmsFullTxt.attempted).toBe(false);
    expect(result.homepage.attempted).toBe(false);
    expect(result.rsl.attempted).toBe(false);
    expect(result.externalRequestCount).toBe(1);
  });

  it("continues gracefully when robots.txt fetch fails entirely", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/robots.txt")) throw new TypeError("network error");
      return makeResponse(200, "ok");
    }) as unknown as typeof fetch;

    const result = await runScan("https://example.com", { resolver: publicResolver });
    expect(result.robotsTxt.fetch?.ok).toBe(false);
    expect(result.robotsTxt.parsed).toBeNull();
    // The scan continues to attempt other resources even though robots.txt failed.
    expect(result.llmsTxt.attempted).toBe(true);
  });
});
