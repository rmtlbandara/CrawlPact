import { beforeEach, describe, expect, it, vi } from "vitest";

const handleMock = vi.fn(
  async (request: Request) =>
    new Response(`handled:${new URL(request.url).pathname}`, {
      headers: { "Content-Type": "text/html" },
    }),
);
vi.mock("@astrojs/cloudflare/handler", () => ({ handle: handleMock }));

let mockEnv: { PUBLIC_SITE_URL: string; PUBLIC_APP_URL?: string };
vi.mock("./lib/env", () => ({ getEnv: () => mockEnv }));

const { fetchWithPreviewSearchIsolation } = await import("./worker");

const PUBLIC_SITE_URL = "https://crawlpact.com";
const PUBLIC_APP_URL = "https://app.crawlpact.com";

/**
 * Phase 2 of the app-subdomain migration (ADR-0010,
 * `docs/baseline/2026-09-09-app-subdomain-phase1/CLOUDFLARE_HOST_BOUNDARY_DESIGN.md`):
 * the Worker-level enforcement that makes "reaching the Worker" insufficient
 * to become a trusted CrawlPact origin. `app.crawlpact.com` is not attached
 * to any real Cloudflare Custom Domain yet — these tests exercise the logic
 * directly against a `Request` whose URL claims that origin, exactly as a
 * real attached Custom Domain would present it to this same Worker code in
 * Phase 3.
 */
describe("fetchWithPreviewSearchIsolation — Phase 2 host boundary", () => {
  const ctx = {} as ExecutionContext;
  const env = { PUBLIC_APP_ENV: "production" } as never;

  describe("app surface must never serve public-owned content", () => {
    beforeEach(() => {
      mockEnv = { PUBLIC_SITE_URL, PUBLIC_APP_URL };
      handleMock.mockClear();
    });

    it("redirects a GET for a public prerendered page (308, preserving path and query)", async () => {
      const request = new Request(`${PUBLIC_APP_URL}/about/?utm_source=x`);
      const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
      expect(response.status).toBe(308);
      expect(response.headers.get("Location")).toBe(`${PUBLIC_SITE_URL}/about/?utm_source=x`);
      expect(handleMock).not.toHaveBeenCalled();
    });

    it("redirects a GET for a public content-collection page", async () => {
      const request = new Request(`${PUBLIC_APP_URL}/crawlers/amazonbot/`);
      const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
      expect(response.status).toBe(308);
      expect(response.headers.get("Location")).toBe(`${PUBLIC_SITE_URL}/crawlers/amazonbot/`);
    });

    it("adds the canonical trailing slash in the same redirect, not a second hop", async () => {
      const request = new Request(`${PUBLIC_APP_URL}/about`);
      const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
      expect(response.status).toBe(308);
      expect(response.headers.get("Location")).toBe(`${PUBLIC_SITE_URL}/about/`);
    });

    /**
     * Found live, 2026-09-09, validating the real Custom Domain attachment:
     * `app.crawlpact.com/about/index.html` (and the other literal Static
     * Assets alias forms) returned the real public page directly — 200, no
     * redirect — instead of hitting this boundary at all, because
     * `isPublicOnlyPath` didn't yet recognize that path shape. These are
     * direct regression guards for that finding, exercised through the same
     * `fetchWithPreviewSearchIsolation` entry point as every other case
     * here — a real Static-Assets-backed run of the same paths happens
     * separately in `tests/integration/static-asset-alias-boundary` against
     * a genuine built Worker + Assets binding, per this repo's own
     * "don't rely only on mocked-`handle()` unit tests" rule for this class
     * of bug.
     */
    it("redirects the root's literal alias forms to the apex root, single hop", async () => {
      for (const alias of ["/index.html", "/index"]) {
        const request = new Request(`${PUBLIC_APP_URL}${alias}`);
        const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
        expect(response.status).toBe(308);
        expect(response.headers.get("Location")).toBe(`${PUBLIC_SITE_URL}/`);
      }
    });

    it("redirects every literal alias form of an exact public route to its canonical apex URL, single hop, preserving query", async () => {
      for (const alias of ["/about/index.html", "/about/index", "/about.html"]) {
        const request = new Request(`${PUBLIC_APP_URL}${alias}?utm_source=x`);
        const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
        expect(response.status).toBe(308);
        expect(response.headers.get("Location")).toBe(`${PUBLIC_SITE_URL}/about/?utm_source=x`);
        expect(handleMock).not.toHaveBeenCalled();
      }
    });

    it("redirects every literal alias form of a collection detail page to its canonical apex URL, single hop (the exact bug this replaces: the old logic redirected to an intermediate .../index.html/-shaped URL)", async () => {
      for (const alias of [
        "/crawlers/gptbot/index.html",
        "/crawlers/gptbot/index",
        "/crawlers/gptbot.html",
      ]) {
        const request = new Request(`${PUBLIC_APP_URL}${alias}`);
        const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
        expect(response.status).toBe(308);
        expect(response.headers.get("Location")).toBe(`${PUBLIC_SITE_URL}/crawlers/gptbot/`);
      }
    });

    it("redirects every literal alias form of a collection root page to its canonical apex URL, single hop", async () => {
      for (const alias of ["/crawlers/index.html", "/crawlers/index", "/crawlers.html"]) {
        const request = new Request(`${PUBLIC_APP_URL}${alias}`);
        const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
        expect(response.status).toBe(308);
        expect(response.headers.get("Location")).toBe(`${PUBLIC_SITE_URL}/crawlers/`);
      }
    });

    it("rejects (404) a non-GET/HEAD request for a literal public-page alias rather than replaying it to the public origin", async () => {
      const request = new Request(`${PUBLIC_APP_URL}/about/index.html`, { method: "POST" });
      const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
      expect(response.status).toBe(404);
      expect(handleMock).not.toHaveBeenCalled();
    });

    it("does not treat an alias-shaped path under a sensitive/private prefix as public (the alias fix must not weaken app/api/admin classification)", async () => {
      for (const path of [
        "/app/index.html",
        "/admin.html",
        "/sign-in/index",
        "/api/domains.html",
      ]) {
        handleMock.mockClear();
        const request = new Request(`${PUBLIC_APP_URL}${path}`);
        const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
        expect(response.status).toBe(200);
        expect(handleMock).toHaveBeenCalledWith(
          expect.objectContaining({ url: `${PUBLIC_APP_URL}${path}` }),
          env,
          ctx,
        );
      }
    });

    it("rejects (404) a non-GET/HEAD request for a public-only path rather than replaying it to the public origin", async () => {
      const request = new Request(`${PUBLIC_APP_URL}/about/`, { method: "POST" });
      const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
      expect(response.status).toBe(404);
      expect(handleMock).not.toHaveBeenCalled();
    });

    it("does not intercept a genuinely app-owned path (e.g. /sign-in)", async () => {
      const request = new Request(`${PUBLIC_APP_URL}/sign-in`);
      const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
      expect(response.status).toBe(200);
      expect(handleMock).toHaveBeenCalledWith(
        expect.objectContaining({ url: `${PUBLIC_APP_URL}/sign-in` }),
        env,
        ctx,
      );
    });

    it("does not intercept the legacy /app/** dashboard path", async () => {
      const request = new Request(`${PUBLIC_APP_URL}/app/domains`);
      const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
      expect(response.status).toBe(200);
      expect(handleMock).toHaveBeenCalledWith(
        expect.objectContaining({ url: `${PUBLIC_APP_URL}/app/domains` }),
        env,
        ctx,
      );
    });
  });

  describe("app surface root rewrite", () => {
    beforeEach(() => {
      mockEnv = { PUBLIC_SITE_URL, PUBLIC_APP_URL };
      handleMock.mockClear();
    });

    /**
     * Found live, 2026-09-10 (owner decision,
     * docs/baseline/2026-09-09-app-subdomain-phase3/): Paddle's own
     * automated checkout-domain review reported it "could not reach"
     * app.crawlpact.com — an anonymous visitor (no session cookie, exactly
     * like any real crawler/reviewer) hitting `/` was silently routed to
     * `/app`, which then redirects to `/sign-in`, a bare auth form with no
     * product description or policy links. `/` now rewrites to a real
     * public landing page (`/app-shell`) instead whenever no session cookie
     * is present at all — a cheap, DB-free `Request`-header check, not a
     * real session validation (an expired/invalid cookie still reaches
     * `/app`'s own real check and redirects to `/sign-in`, unchanged).
     */
    it("rewrites '/' to the new public app-shell landing page when no session cookie is present", async () => {
      const request = new Request(`${PUBLIC_APP_URL}/`);
      const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
      expect(response.status).toBe(200);
      expect(handleMock).toHaveBeenCalledWith(
        expect.objectContaining({ url: `${PUBLIC_APP_URL}/app-shell` }),
        env,
        ctx,
      );
      expect(await response.text()).toBe("handled:/app-shell");
    });

    it("rewrites '/' to the existing /app dashboard implementation when a session cookie is present (unchanged for real signed-in visitors)", async () => {
      const request = new Request(`${PUBLIC_APP_URL}/`, {
        headers: { cookie: "crawlpact_session=some-opaque-token" },
      });
      const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
      expect(response.status).toBe(200);
      expect(handleMock).toHaveBeenCalledWith(
        expect.objectContaining({ url: `${PUBLIC_APP_URL}/app` }),
        env,
        ctx,
      );
      expect(await response.text()).toBe("handled:/app");
    });

    it("preserves the request method on the rewrite", async () => {
      handleMock.mockClear();
      const request = new Request(`${PUBLIC_APP_URL}/`, { method: "HEAD" });
      await fetchWithPreviewSearchIsolation(request, env, ctx);
      const [rewrittenRequest] = handleMock.mock.calls[0] as [Request];
      expect(rewrittenRequest.method).toBe("HEAD");
    });

    it("does not redirect '/' to the public homepage (root is the one deliberate exception to the public-only rule)", async () => {
      const request = new Request(`${PUBLIC_APP_URL}/`);
      const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
      expect(response.status).not.toBe(308);
    });
  });

  describe("public surface is unaffected by the new app-surface logic", () => {
    beforeEach(() => {
      mockEnv = { PUBLIC_SITE_URL, PUBLIC_APP_URL };
      handleMock.mockClear();
    });

    it("serves a public page on the public host normally", async () => {
      const request = new Request(`${PUBLIC_SITE_URL}/about/`);
      const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
      expect(response.status).toBe(200);
    });

    it("does not rewrite '/' on the public host", async () => {
      handleMock.mockClear();
      const request = new Request(`${PUBLIC_SITE_URL}/`);
      await fetchWithPreviewSearchIsolation(request, env, ctx);
      expect(handleMock).toHaveBeenCalledWith(
        expect.objectContaining({ url: `${PUBLIC_SITE_URL}/` }),
        env,
        ctx,
      );
    });

    it("still serves /app and /sign-in on the public host (Phase 2/3 migration-compatibility window — unchanged apex behavior)", async () => {
      for (const path of ["/app", "/sign-in", "/app/domains"]) {
        handleMock.mockClear();
        const request = new Request(`${PUBLIC_SITE_URL}${path}`);
        const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
        expect(response.status).toBe(200);
      }
    });

    /**
     * The pre-existing apex alias, corrected using the same
     * `resolveCanonicalRedirectTarget` mechanism as the app-host case above
     * — not a second, competing canonical scheme. Found live, 2026-09-09:
     * `crawlpact.com/about/index.html` also returned 200 directly (this was
     * never app-host-specific), and `crawlpact.com/crawlers/gptbot/index.html`
     * redirected to the broken `/crawlers/gptbot/index.html/`.
     */
    it("redirects the apex's own literal alias forms to the single canonical destination, 301, one hop", async () => {
      for (const [alias, canonical] of [
        ["/index.html", "/"],
        ["/index", "/"],
        ["/about/index.html", "/about/"],
        ["/about.html", "/about/"],
        ["/crawlers/gptbot/index.html", "/crawlers/gptbot/"],
        ["/crawlers/gptbot.html", "/crawlers/gptbot/"],
        ["/crawlers/index.html", "/crawlers/"],
      ] as const) {
        handleMock.mockClear();
        const request = new Request(`${PUBLIC_SITE_URL}${alias}`);
        const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
        expect(response.status).toBe(301);
        expect(response.headers.get("Location")).toBe(`${PUBLIC_SITE_URL}${canonical}`);
        expect(handleMock).not.toHaveBeenCalled();
      }
    });

    it("preserves query string through the apex alias canonicalization", async () => {
      const request = new Request(`${PUBLIC_SITE_URL}/about/index.html?ref=abc`);
      const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
      expect(response.status).toBe(301);
      expect(response.headers.get("Location")).toBe(`${PUBLIC_SITE_URL}/about/?ref=abc`);
    });

    it("does not redirect a POST to an apex alias path (unsafe methods fall through unchanged, matching existing bare-path behavior)", async () => {
      const request = new Request(`${PUBLIC_SITE_URL}/about/index.html`, { method: "POST" });
      const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
      expect(response.status).toBe(200);
      expect(handleMock).toHaveBeenCalled();
    });
  });

  describe("unknown host fails closed for sensitive paths only", () => {
    beforeEach(() => {
      mockEnv = { PUBLIC_SITE_URL, PUBLIC_APP_URL };
      handleMock.mockClear();
    });
    const UNKNOWN_HOST = "https://crawlpact-web.rmtlbandara.workers.dev";

    it("rejects (404) /sign-in on an unrecognized host", async () => {
      const request = new Request(`${UNKNOWN_HOST}/sign-in`);
      const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
      expect(response.status).toBe(404);
      expect(handleMock).not.toHaveBeenCalled();
    });

    it("rejects (404) /app on an unrecognized host", async () => {
      const request = new Request(`${UNKNOWN_HOST}/app`);
      const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
      expect(response.status).toBe(404);
    });

    it("rejects (404) /admin on an unrecognized host", async () => {
      const request = new Request(`${UNKNOWN_HOST}/admin`);
      const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
      expect(response.status).toBe(404);
    });

    it("rejects (404) a mutating /api/* request on an unrecognized host", async () => {
      const request = new Request(`${UNKNOWN_HOST}/api/domains`, { method: "POST" });
      const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
      expect(response.status).toBe(404);
    });

    it("does NOT fail closed for public marketing content on an unrecognized host (no security boundary to enforce there)", async () => {
      const request = new Request(`${UNKNOWN_HOST}/about/`);
      const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
      expect(response.status).toBe(200);
      expect(handleMock).toHaveBeenCalled();
    });
  });
});
