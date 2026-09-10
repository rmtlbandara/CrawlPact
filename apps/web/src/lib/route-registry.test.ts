import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  needsTrailingSlashRedirectPreview,
  PRERENDERED_ROUTES,
  resolveCanonicalRedirectTarget,
  resolveStaticAssetAlias,
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

/**
 * Found live, 2026-09-09, validating the real Custom Domain attachment for
 * `app.crawlpact.com`: `/about/index.html` (and every other prerendered
 * page's literal Static Assets alias) returned the real public page
 * directly — 200, no redirect, no `X-Robots-Tag` — because nothing in this
 * registry recognized that path shape at all. Every case here is a direct
 * regression guard for that finding, not a hypothetical.
 */
describe("resolveStaticAssetAlias", () => {
  it("resolves the site root's alias forms", () => {
    expect(resolveStaticAssetAlias("/index.html")).toBe("/");
    expect(resolveStaticAssetAlias("/index")).toBe("/");
  });

  it.each(PRERENDERED_ROUTES)("resolves every alias form of the exact route %s", (route) => {
    expect(resolveStaticAssetAlias(`${route}/index.html`)).toBe(`${route}/`);
    expect(resolveStaticAssetAlias(`${route}/index`)).toBe(`${route}/`);
    expect(resolveStaticAssetAlias(`${route}.html`)).toBe(`${route}/`);
  });

  it("resolves every alias form of a collection root (also an exact PRERENDERED_ROUTES entry)", () => {
    for (const root of ["/crawlers", "/guides", "/platforms"]) {
      expect(resolveStaticAssetAlias(`${root}/index.html`)).toBe(`${root}/`);
      expect(resolveStaticAssetAlias(`${root}/index`)).toBe(`${root}/`);
      expect(resolveStaticAssetAlias(`${root}.html`)).toBe(`${root}/`);
    }
  });

  it("resolves every alias form of a representative collection detail page", () => {
    for (const detail of [
      "/crawlers/gptbot",
      "/guides/robots-txt-syntax-basics",
      "/platforms/vercel",
    ]) {
      expect(resolveStaticAssetAlias(`${detail}/index.html`)).toBe(`${detail}/`);
      expect(resolveStaticAssetAlias(`${detail}/index`)).toBe(`${detail}/`);
      expect(resolveStaticAssetAlias(`${detail}.html`)).toBe(`${detail}/`);
    }
  });

  it("does not resolve an SSR-indexable route's alias forms (SSR pages have no literal Static Assets file — verified live, /pricing/index.html 404s)", () => {
    for (const route of SSR_INDEXABLE_ROUTES) {
      expect(resolveStaticAssetAlias(`${route}/index.html`)).toBeNull();
      expect(resolveStaticAssetAlias(`${route}.html`)).toBeNull();
    }
  });

  it("never invents ownership for an alias-shaped path under a sensitive/private prefix", () => {
    for (const path of [
      "/app/index.html",
      "/app/index",
      "/app.html",
      "/admin/index.html",
      "/admin.html",
      "/sign-in/index.html",
      "/sign-in.html",
      "/api/domains/index.html",
      "/api/domains.html",
    ]) {
      expect(resolveStaticAssetAlias(path)).toBeNull();
    }
  });

  it("does not false-positive on a path that merely looks alias-shaped but matches no known route", () => {
    for (const path of [
      "/apparently-fine.html",
      "/apparently-fine/index.html",
      "/nonexistent/index.html",
    ]) {
      expect(resolveStaticAssetAlias(path)).toBeNull();
    }
  });

  it("returns null for an already-canonical path", () => {
    expect(resolveStaticAssetAlias("/about/")).toBeNull();
    expect(resolveStaticAssetAlias("/about")).toBeNull();
    expect(resolveStaticAssetAlias("/")).toBeNull();
  });
});

describe("resolveCanonicalRedirectTarget — single centralized canonicalization mechanism", () => {
  it("resolves the root alias in one hop", () => {
    expect(resolveCanonicalRedirectTarget("/index.html")).toBe("/");
    expect(resolveCanonicalRedirectTarget("/index")).toBe("/");
  });

  it("resolves an exact route's bare form and every alias form to the identical single-hop destination", () => {
    expect(resolveCanonicalRedirectTarget("/about")).toBe("/about/");
    expect(resolveCanonicalRedirectTarget("/about/index.html")).toBe("/about/");
    expect(resolveCanonicalRedirectTarget("/about/index")).toBe("/about/");
    expect(resolveCanonicalRedirectTarget("/about.html")).toBe("/about/");
  });

  it("resolves a collection detail page's bare form and every alias form to the identical single-hop destination (the exact bug this replaces: the old logic appended '/' to the alias verbatim, producing /crawlers/gptbot/index.html/)", () => {
    expect(resolveCanonicalRedirectTarget("/crawlers/gptbot")).toBe("/crawlers/gptbot/");
    expect(resolveCanonicalRedirectTarget("/crawlers/gptbot/index.html")).toBe("/crawlers/gptbot/");
    expect(resolveCanonicalRedirectTarget("/crawlers/gptbot/index")).toBe("/crawlers/gptbot/");
    expect(resolveCanonicalRedirectTarget("/crawlers/gptbot.html")).toBe("/crawlers/gptbot/");
  });

  it("still resolves the plain SSR bare-path case (unrelated to the alias fix, must not regress)", () => {
    expect(resolveCanonicalRedirectTarget("/pricing")).toBe("/pricing/");
    expect(resolveCanonicalRedirectTarget("/for/agencies")).toBe("/for/agencies/");
  });

  it("returns null for already-canonical paths and the root", () => {
    expect(resolveCanonicalRedirectTarget("/")).toBeNull();
    expect(resolveCanonicalRedirectTarget("/about/")).toBeNull();
    expect(resolveCanonicalRedirectTarget("/crawlers/gptbot/")).toBeNull();
  });

  it("never resolves a sensitive/private/near-match path", () => {
    for (const path of [
      "/app/index.html",
      "/admin.html",
      "/sign-in/index",
      "/api/domains.html",
      "/apparently-fine",
      "/apparently-fine.html",
    ]) {
      expect(resolveCanonicalRedirectTarget(path)).toBeNull();
    }
  });
});
