import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  needsTrailingSlashRedirectPreview,
  PRERENDERED_ROUTES,
  SSR_INDEXABLE_PREFIXES,
  SSR_INDEXABLE_ROUTES,
} from "./route-registry";

/**
 * Phase 20 canonical URL contract: `public/_redirects` (301, for prerendered
 * pages) and `middleware.ts` (301, for SSR pages) must never drift from
 * `route-registry.ts`'s route lists — this is what "one strong source of
 * truth" actually enforces, rather than three hand-maintained lists that
 * quietly diverge over time.
 */
describe("public/_redirects matches route-registry.ts's PRERENDERED_ROUTES", () => {
  const redirectsPath = fileURLToPath(new URL("../../public/_redirects", import.meta.url));
  const content = readFileSync(redirectsPath, "utf-8");

  for (const route of PRERENDERED_ROUTES) {
    it(`has a 301 rule redirecting "${route}" to "${route}/"`, () => {
      const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rule = new RegExp(`^${escaped} ${escaped}/ 301$`, "m");
      expect(content).toMatch(rule);
    });
  }

  it("has wildcard rules for every prerendered content-collection route", () => {
    for (const collection of ["crawlers", "guides", "platforms"]) {
      expect(content).toMatch(new RegExp(`^/${collection}/:slug /${collection}/:slug/ 301$`, "m"));
    }
  });

  it("declares no rule for a route that isn't in PRERENDERED_ROUTES", () => {
    const declaredSources = [...content.matchAll(/^(\/\S+) \/\S+\/ 301$/gm)].map((m) => m[1]!);
    const known = new Set([
      ...PRERENDERED_ROUTES,
      "/crawlers/:slug",
      "/guides/:slug",
      "/platforms/:slug",
    ]);
    for (const source of declaredSources) {
      expect(known.has(source), `unexpected _redirects source "${source}"`).toBe(true);
    }
  });
});

describe("route-registry.ts's SSR lists stay disjoint from PRERENDERED_ROUTES", () => {
  it("no path appears in both the prerendered and SSR route lists", () => {
    const prerendered = new Set(PRERENDERED_ROUTES);
    for (const route of SSR_INDEXABLE_ROUTES) {
      expect(prerendered.has(route)).toBe(false);
    }
  });

  it("no SSR prefix collides with a prerendered exact route", () => {
    for (const prefix of SSR_INDEXABLE_PREFIXES) {
      for (const route of PRERENDERED_ROUTES) {
        expect(route.startsWith(prefix)).toBe(false);
      }
    }
  });
});

/**
 * `needsTrailingSlashRedirectPreview` exists because `run_worker_first`
 * (preview only, wrangler.jsonc) bypasses `public/_redirects` entirely for
 * asset-matched paths — confirmed locally, 2026-09-07 (see its doc comment
 * in route-registry.ts). Preview's Worker (`worker.ts`) therefore needs to
 * catch every case `public/_redirects` handles on production, PLUS the SSR
 * cases `middleware.ts` handles — this is the one function that must cover
 * both.
 */
describe("needsTrailingSlashRedirectPreview", () => {
  it("covers every prerendered exact route (normally handled by _redirects on production)", () => {
    for (const route of PRERENDERED_ROUTES) {
      expect(needsTrailingSlashRedirectPreview(route)).toBe(true);
    }
  });

  it("covers every prerendered content-collection route (crawlers/guides/platforms)", () => {
    expect(needsTrailingSlashRedirectPreview("/crawlers/amazonbot")).toBe(true);
    expect(needsTrailingSlashRedirectPreview("/guides/robots-txt-syntax-basics")).toBe(true);
    expect(needsTrailingSlashRedirectPreview("/platforms/vercel")).toBe(true);
  });

  it("covers every SSR exact route and prefix (normally handled by middleware.ts)", () => {
    for (const route of SSR_INDEXABLE_ROUTES) {
      expect(needsTrailingSlashRedirectPreview(route)).toBe(true);
    }
    expect(needsTrailingSlashRedirectPreview("/for/agencies")).toBe(true);
  });

  it("does not redirect an already-canonical path, or the root", () => {
    expect(needsTrailingSlashRedirectPreview("/about/")).toBe(false);
    expect(needsTrailingSlashRedirectPreview("/crawlers/amazonbot/")).toBe(false);
    expect(needsTrailingSlashRedirectPreview("/")).toBe(false);
  });

  it("never touches API, app, admin, auth, sign-in, pay, or audit routes", () => {
    for (const path of ["/api/audit", "/app/domains", "/admin", "/sign-in", "/pay"]) {
      expect(needsTrailingSlashRedirectPreview(path)).toBe(false);
    }
  });
});
