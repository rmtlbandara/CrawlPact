import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("astro:middleware", () => ({ defineMiddleware: (fn: unknown) => fn }));
vi.mock("./lib/env", () => ({ getEnv: () => ({ PUBLIC_APP_ENV: "production" }) }));

const { onRequest } = await import("./middleware");

function fakeContext(pathname: string): { url: URL } {
  return { url: new URL(`https://crawlpact.com${pathname}`) };
}

/**
 * Phase 11 (docs/performance/PUBLIC_CACHE_POLICY.md): proves the
 * deny-by-default caching default this phase added to middleware.ts —
 * every SSR response gets `Cache-Control: private, no-store` unless the
 * page already set its own. This is the entire safety mechanism the public
 * cache policy depends on (see the middleware's own doc comment for why a
 * missing Cache-Control header is not the same as "not cached" once
 * Workers Cache is enabled), so it's tested directly rather than only
 * documented.
 */
describe("middleware Cache-Control default", () => {
  it("sets private, no-store when a route sets no Cache-Control of its own", async () => {
    const next = async () => new Response("ok", { headers: {} });
    const response = (await onRequest(
      // @ts-expect-error minimal fake context, only .url is read by this middleware
      fakeContext("/app/domains"),
      next,
    )) as Response;
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("never overrides a Cache-Control a page already set (e.g. a public page opting into caching)", async () => {
    const next = async () =>
      new Response("ok", { headers: { "Cache-Control": "public, max-age=300" } });
    const response = (await onRequest(
      // @ts-expect-error minimal fake context, only .url is read by this middleware
      fakeContext("/changelog"),
      next,
    )) as Response;
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
  });

  it("defaults an API response to private, no-store just like an HTML page", async () => {
    const next = async () =>
      new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    const response = (await onRequest(
      // @ts-expect-error minimal fake context, only .url is read by this middleware
      fakeContext("/api/domains"),
      next,
    )) as Response;
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("defaults an admin response to private, no-store", async () => {
    const next = async () => new Response("<html></html>", { headers: {} });
    const response = (await onRequest(
      // @ts-expect-error minimal fake context, only .url is read by this middleware
      fakeContext("/admin/users"),
      next,
    )) as Response;
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});

/**
 * Complements the runtime tests above: an Astro page's own
 * `Astro.response.headers.set(...)` call can't be exercised without a real
 * Astro render (this repo's test suite only exercises `.ts` API routes,
 * never `.astro` files directly), so the explicit public-cache opt-ins this
 * phase added are instead verified to still be present in source — the
 * same static-verification pattern `security-headers.test.ts` already uses
 * for `public/_headers`. If one of these ever gets deleted or edited by
 * accident, this fails instead of silently reverting that page to the safe
 * (but D1-read-heavier) private default.
 */
describe("public cache policy opt-ins are present in source (docs/performance/PUBLIC_CACHE_POLICY.md)", () => {
  function readSource(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf-8");
  }

  it("changelog.astro opts into public caching", () => {
    expect(readSource("./pages/changelog.astro")).toContain(
      'Astro.response.headers.set("Cache-Control", "public, max-age=300")',
    );
  });

  it("scanner.astro opts into public caching", () => {
    expect(readSource("./pages/scanner.astro")).toContain(
      'Astro.response.headers.set("Cache-Control", "public, max-age=300")',
    );
  });

  it("for/[slug].astro opts into public caching", () => {
    expect(readSource("./pages/for/[slug].astro")).toContain(
      'Astro.response.headers.set("Cache-Control", "public, max-age=300")',
    );
  });

  it("status.astro keeps its own shorter public TTL", () => {
    expect(readSource("./pages/status.astro")).toContain(
      'Astro.response.headers.set("Cache-Control", "public, max-age=30")',
    );
  });
});
