import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Asserts on the actual content of the source-controlled `apps/web/public/robots.txt` —
 * the file Cloudflare serves verbatim for the production site. Exists specifically to catch
 * two real regressions this repo has already had: (1) the non-standard `/audit/*` wildcard
 * form instead of the standard `/audit/` path-prefix form, and (2) an AI-crawler-specific
 * `Disallow` block being added to this file (CrawlPact's own product audits exactly these
 * crawlers — the site must not block them from crawling its own content).
 */
describe("public/robots.txt", () => {
  const robotsTxtPath = fileURLToPath(new URL("../../public/robots.txt", import.meta.url));
  const content = readFileSync(robotsTxtPath, "utf-8");

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
    // Cloudflare-managed injection (which this static file wouldn't show
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
