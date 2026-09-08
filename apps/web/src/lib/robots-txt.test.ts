import { describe, expect, it, vi } from "vitest";

vi.mock("./env", () => ({ getEnv: () => ({ PUBLIC_APP_ENV: "production" }) }));

const { PREVIEW_ROBOTS_TXT, PRODUCTION_ROBOTS_TXT } = await import("../pages/robots.txt");

/**
 * Asserts on the actual content served by `apps/web/src/pages/robots.txt.ts`
 * (Phase 20: converted from a static `public/robots.txt` file to an SSR
 * endpoint so preview and production can serve different content — see that
 * file's doc comment). Exists specifically to catch two real regressions
 * this repo has already had: (1) the non-standard `/audit/*` wildcard form
 * instead of the standard `/audit/` path-prefix form, and (2) an
 * AI-crawler-specific `Disallow` block being added to the production
 * content (CrawlPact's own product audits exactly these crawlers — the site
 * must not block them from crawling its own content).
 */
describe("production robots.txt", () => {
  const content = PRODUCTION_ROBOTS_TXT;

  it("uses the standard path-prefix form for excluding /audit/, not a wildcard", () => {
    expect(content).toContain("Disallow: /audit/\n");
    expect(content).not.toContain("Disallow: /audit/*");
  });

  it("keeps public marketing pages crawlable (wildcard user-agent allows /)", () => {
    expect(content).toMatch(/User-agent: \*\s*\n\s*Allow: \//);
  });

  it("excludes the expected non-marketing paths", () => {
    for (const path of ["/api/", "/audit/", "/app", "/sign-in", "/dev/"]) {
      expect(content).toContain(`Disallow: ${path}`);
    }
  });

  it("introduces no AI-crawler-specific block", () => {
    // CrawlPact's own product audits these crawlers — the site itself must
    // never disallow them, whether via a hand-authored block here or a
    // Cloudflare-managed injection (which this constant wouldn't show
    // anyway, since that's added at the edge, not in source).
    const aiCrawlerTokens = [
      "GPTBot",
      "ClaudeBot",
      "Google-Extended",
      "CCBot",
      "Applebot-Extended",
      "Bytespider",
      "meta-externalagent",
      "OAI-SearchBot",
      "PerplexityBot",
      "Amazonbot",
    ];
    for (const token of aiCrawlerTokens) {
      expect(content).not.toContain(`User-agent: ${token}`);
    }
    expect(content).not.toMatch(/^Content-Signal:/m);
  });

  it("preserves the sitemap declaration", () => {
    expect(content).toContain("Sitemap: https://crawlpact.com/sitemap.xml");
  });
});

describe("preview robots.txt (Phase 20, P0 search isolation)", () => {
  const content = PREVIEW_ROBOTS_TXT;

  it("disallows crawling entirely", () => {
    expect(content).toMatch(/User-agent: \*\s*\n\s*Disallow: \/\s*$/);
  });

  it("declares no sitemap — nothing on preview should ever be submitted for indexing", () => {
    expect(content).not.toContain("Sitemap:");
  });

  it("is a strictly different, more restrictive document than production", () => {
    expect(content).not.toBe(PRODUCTION_ROBOTS_TXT);
  });
});
