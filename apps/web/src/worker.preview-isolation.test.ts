import { describe, expect, it, vi } from "vitest";

vi.mock("@astrojs/cloudflare/handler", () => ({
  handle: vi.fn(
    async () => new Response("<html></html>", { headers: { "Content-Type": "text/html" } }),
  ),
}));
// Phase 2 of the app-subdomain migration (ADR-0010): `worker.ts`'s
// host-boundary logic reads `PUBLIC_SITE_URL`/`PUBLIC_APP_URL` via
// `lib/origin.ts` (backed by this same `getEnv()` mock) to classify which
// surface a request arrived on. Every request in this file targets
// `preview.crawlpact.com`, so `PUBLIC_SITE_URL` must match that for these
// pre-existing preview-isolation assertions to keep classifying as
// "public" (unaffected by the new app-surface/unknown-host logic tested in
// `worker.host-boundary.test.ts`).
vi.mock("./lib/env", () => ({
  getEnv: () => ({ PUBLIC_SITE_URL: "https://preview.crawlpact.com" }),
}));

const { fetchWithPreviewSearchIsolation } = await import("./worker");

/**
 * Phase 20, P0 (docs/baseline/2026-09-07-phase20/PREVIEW_SEARCH_ISOLATION.md):
 * preview.crawlpact.com must never compete with production in Google
 * Search. This wrapper is the one mechanism that reaches every preview
 * response regardless of rendering mode (prerendered pages never run Astro
 * middleware — see middleware.ts's doc comment — so the header has to be
 * stamped here, at the outermost Worker fetch handler, with
 * `env.preview.assets.run_worker_first: true` in wrangler.jsonc ensuring
 * every preview request reaches this code at all).
 */
describe("fetchWithPreviewSearchIsolation", () => {
  const request = new Request("https://preview.crawlpact.com/about/");
  const ctx = {} as ExecutionContext;

  it("stamps X-Robots-Tag: noindex on every response when PUBLIC_APP_ENV is preview", async () => {
    const env = { PUBLIC_APP_ENV: "preview" } as never;
    const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
  });

  it("does not touch the response when PUBLIC_APP_ENV is production", async () => {
    const env = { PUBLIC_APP_ENV: "production" } as never;
    const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
    expect(response.headers.get("X-Robots-Tag")).toBeNull();
  });

  it("does not touch the response for local development", async () => {
    const env = { PUBLIC_APP_ENV: "local" } as never;
    const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
    expect(response.headers.get("X-Robots-Tag")).toBeNull();
  });
});

/**
 * `run_worker_first` (preview only) has a confirmed side effect: it bypasses
 * `public/_redirects` entirely for asset-matched paths (verified locally,
 * 2026-09-07 — see `needsTrailingSlashRedirectPreview`'s doc comment in
 * route-registry.ts). Without this branch, preview would silently regress
 * the Phase 20 canonical trailing-slash redirect for every prerendered page.
 */
describe("fetchWithPreviewSearchIsolation — preview-only trailing-slash redirect", () => {
  const env = { PUBLIC_APP_ENV: "preview" } as never;
  const ctx = {} as ExecutionContext;

  it("301-redirects a bare prerendered-page request before ever calling handle()", async () => {
    const request = new Request("https://preview.crawlpact.com/about");
    const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe("https://preview.crawlpact.com/about/");
  });

  it("301-redirects a bare content-collection request", async () => {
    const request = new Request("https://preview.crawlpact.com/crawlers/amazonbot");
    const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe(
      "https://preview.crawlpact.com/crawlers/amazonbot/",
    );
  });

  it("does not redirect an already-canonical request — falls through to handle() and gets stamped", async () => {
    const request = new Request("https://preview.crawlpact.com/about/");
    const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
    expect(response.status).not.toBe(301);
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
  });

  it("does not redirect a non-indexable route (e.g. /api/*)", async () => {
    const request = new Request("https://preview.crawlpact.com/api/audit", { method: "POST" });
    const response = await fetchWithPreviewSearchIsolation(request, env, ctx);
    expect(response.status).not.toBe(301);
  });
});
