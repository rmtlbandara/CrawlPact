import { afterEach, describe, expect, it, vi } from "vitest";
import { safeFetch } from "./safe-fetch";
import type { DnsResolver } from "./dns-resolve";

const publicResolver: DnsResolver = async () => ({ ok: true, addresses: ["93.184.216.34"] });
const privateResolver: DnsResolver = async () => ({ ok: true, addresses: ["10.0.0.1"] });

function makeResponse(
  status: number,
  body: string,
  headers: Record<string, string> = {},
): Response {
  return new Response(body, { status, headers });
}

function streamOf(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

describe("safeFetch", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns the body and metadata for a successful fetch", async () => {
    globalThis.fetch = vi.fn(async () =>
      makeResponse(200, "User-agent: *\nDisallow: /admin\n", { "content-type": "text/plain" }),
    ) as unknown as typeof fetch;

    const result = await safeFetch("https://example.com/robots.txt", { resolver: publicResolver });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.statusCode).toBe(200);
      expect(result.body).toContain("Disallow: /admin");
      expect(result.redirectCount).toBe(0);
      expect(result.truncated).toBe(false);
    }
  });

  it("returns ok:true with the status code for a 404 (not a fetch failure)", async () => {
    globalThis.fetch = vi.fn(async () => makeResponse(404, "")) as unknown as typeof fetch;
    const result = await safeFetch("https://example.com/robots.txt", { resolver: publicResolver });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.statusCode).toBe(404);
  });

  it("returns ok:true with the status code for a 5xx", async () => {
    globalThis.fetch = vi.fn(async () => makeResponse(503, "")) as unknown as typeof fetch;
    const result = await safeFetch("https://example.com/", { resolver: publicResolver });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.statusCode).toBe(503);
  });

  it("rejects an unsafe initial target without making a request", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const result = await safeFetch("https://internal.example/", { resolver: privateResolver });
    expect(result).toMatchObject({ ok: false, errorCategory: "unsafe_target" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("follows a redirect chain and revalidates the destination", async () => {
    let call = 0;
    globalThis.fetch = vi.fn(async () => {
      call += 1;
      if (call === 1) return makeResponse(301, "", { location: "https://example.com/final" });
      return makeResponse(200, "final content");
    }) as unknown as typeof fetch;

    const result = await safeFetch("https://example.com/start", { resolver: publicResolver });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.finalUrl).toBe("https://example.com/final");
      expect(result.redirectCount).toBe(1);
    }
  });

  it("fails with too_many_redirects beyond the configured limit", async () => {
    let call = 0;
    globalThis.fetch = vi.fn(async () => {
      call += 1;
      return makeResponse(302, "", { location: `https://example.com/hop-${call}` });
    }) as unknown as typeof fetch;

    const result = await safeFetch("https://example.com/start", {
      resolver: publicResolver,
      maxRedirects: 3,
    });
    expect(result).toMatchObject({ ok: false, errorCategory: "too_many_redirects" });
  });

  it("detects a redirect loop", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/a")) return makeResponse(302, "", { location: "https://example.com/b" });
      return makeResponse(302, "", { location: "https://example.com/a" });
    }) as unknown as typeof fetch;

    const result = await safeFetch("https://example.com/a", {
      resolver: publicResolver,
      maxRedirects: 10,
    });
    expect(result).toMatchObject({ ok: false, errorCategory: "redirect_loop" });
  });

  it("rejects a redirect to an unsafe address", async () => {
    globalThis.fetch = vi.fn(async () =>
      makeResponse(302, "", { location: "https://internal.example/" }),
    ) as unknown as typeof fetch;

    const result = await safeFetch("https://example.com/start", {
      resolver: (hostname: string) =>
        hostname === "internal.example"
          ? Promise.resolve({ ok: true, addresses: ["10.0.0.1"] })
          : Promise.resolve({ ok: true, addresses: ["93.184.216.34"] }),
    });
    expect(result).toMatchObject({ ok: false, errorCategory: "unsafe_redirect_target" });
  });

  it("truncates a body exceeding the configured size limit", async () => {
    const bigBody = "x".repeat(1000);
    globalThis.fetch = vi.fn(
      async () => new Response(streamOf(bigBody), { status: 200 }),
    ) as unknown as typeof fetch;

    const result = await safeFetch("https://example.com/big", {
      resolver: publicResolver,
      maxBodyBytes: 100,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.truncated).toBe(true);
      expect(result.contentSizeBytes).toBeLessThanOrEqual(100);
    }
  });

  it("categorises a timeout distinctly from a connection failure", async () => {
    globalThis.fetch = vi.fn(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new DOMException("Aborted", "AbortError")), 5);
        }),
    ) as unknown as typeof fetch;

    const result = await safeFetch("https://example.com/slow", {
      resolver: publicResolver,
      timeoutMs: 10,
    });
    expect(result).toMatchObject({ ok: false, errorCategory: "timeout" });
  });

  it("never sends a third-party crawler's user agent", async () => {
    let sentHeaders: HeadersInit | undefined;
    globalThis.fetch = vi.fn(async (_input, init?: RequestInit) => {
      sentHeaders = init?.headers;
      return makeResponse(200, "ok");
    }) as unknown as typeof fetch;

    await safeFetch("https://example.com/", { resolver: publicResolver });
    const headerRecord = sentHeaders as Record<string, string>;
    expect(headerRecord["User-Agent"]).toBe(
      "CrawlPactAuditBot/1.0 (+https://crawlpact.com/scanner)",
    );
  });
});
