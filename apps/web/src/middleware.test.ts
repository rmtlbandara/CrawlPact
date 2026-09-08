import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("astro:middleware", () => ({ defineMiddleware: (fn: unknown) => fn }));
vi.mock("./lib/env", () => ({ getEnv: () => ({ PUBLIC_APP_ENV: "production" }) }));

const { onRequest, needsTrailingSlashRedirect } = await import("./middleware");

function fakeContext(pathname: string, method = "GET"): { url: URL; request: Request } {
  const url = new URL(`https://crawlpact.com${pathname}`);
  return { url, request: new Request(url, { method }) };
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
      // Canonical trailing-slash form — Phase 20's needsTrailingSlashRedirect
      // would otherwise short-circuit this request with a 301 before next()
      // ever runs.
      // @ts-expect-error minimal fake context, only .url is read by this middleware
      fakeContext("/changelog/"),
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
 * Phase 20 canonical URL contract (docs/baseline/2026-09-07-phase20/CANONICAL_URL_CONTRACT.md):
 * trailing slash is canonical for every indexable page. These SSR pages
 * have no static asset at all, so nothing has ever redirected them before —
 * both `/pricing` and `/pricing/` independently returned 200 in production
 * (confirmed live, 2026-09-07). `needsTrailingSlashRedirect` is the pure
 * decision function; `onRequest` is exercised end-to-end to prove the
 * actual redirect response it produces.
 */
describe("needsTrailingSlashRedirect", () => {
  it("requires a redirect for every SSR indexable exact route missing its slash", () => {
    for (const path of [
      "/pricing",
      "/status",
      "/changelog",
      "/scanner",
      "/observatory",
      "/observatory/registry",
    ]) {
      expect(needsTrailingSlashRedirect(path)).toBe(true);
    }
  });

  it("requires a redirect for a dynamic vertical/research route missing its slash", () => {
    expect(needsTrailingSlashRedirect("/for/agencies")).toBe(true);
    expect(needsTrailingSlashRedirect("/research/some-slug")).toBe(true);
  });

  it("does not redirect a route that already has its trailing slash, or the root", () => {
    expect(needsTrailingSlashRedirect("/pricing/")).toBe(false);
    expect(needsTrailingSlashRedirect("/for/agencies/")).toBe(false);
    expect(needsTrailingSlashRedirect("/")).toBe(false);
  });

  it("never touches API, app, admin, auth, sign-in, pay, or audit routes", () => {
    for (const path of [
      "/api/audit",
      "/app/domains",
      "/admin",
      "/sign-in",
      "/pay",
      "/audit/some-id",
      "/api/auth/google/begin",
    ]) {
      expect(needsTrailingSlashRedirect(path)).toBe(false);
    }
  });
});

describe("middleware trailing-slash redirect (end-to-end)", () => {
  const next = async () => new Response("should not be reached");

  it("301-redirects a GET request for a bare SSR route to its trailing-slash form", async () => {
    const response = (await onRequest(
      // @ts-expect-error minimal fake context
      fakeContext("/pricing"),
      next,
    )) as Response;
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe("https://crawlpact.com/pricing/");
  });

  it("preserves the query string across the redirect", async () => {
    const response = (await onRequest(
      // @ts-expect-error minimal fake context
      fakeContext("/for/agencies?utm_source=test"),
      next,
    )) as Response;
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe(
      "https://crawlpact.com/for/agencies/?utm_source=test",
    );
  });

  it("301-redirects HEAD the same way as GET", async () => {
    const response = (await onRequest(
      // @ts-expect-error minimal fake context
      fakeContext("/status", "HEAD"),
      next,
    )) as Response;
    expect(response.status).toBe(301);
  });

  it("does not redirect a POST (method/body semantics must be preserved on mutating routes)", async () => {
    const postNext = async () => new Response("posted");
    const response = (await onRequest(
      // @ts-expect-error minimal fake context
      fakeContext("/pricing", "POST"),
      postNext,
    )) as Response;
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("posted");
  });

  it("passes an already-canonical request straight through to next()", async () => {
    const response = (await onRequest(
      // @ts-expect-error minimal fake context
      fakeContext("/pricing/"),
      next,
    )) as Response;
    expect(response.status).toBe(200);
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
