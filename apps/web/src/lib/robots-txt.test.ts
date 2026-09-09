import { describe, expect, it, vi } from "vitest";

const PUBLIC_ORIGIN = "https://crawlpact.com";
const APP_ORIGIN = "https://app.crawlpact.com";

let mockEnv: { PUBLIC_APP_ENV: string; PUBLIC_SITE_URL: string; PUBLIC_APP_URL?: string };
vi.mock("./env", () => ({ getEnv: () => mockEnv }));

const { PREVIEW_ROBOTS_TXT, PRODUCTION_ROBOTS_TXT, APP_ROBOTS_TXT, GET } =
  await import("../pages/robots.txt");

mockEnv = {
  PUBLIC_APP_ENV: "production",
  PUBLIC_SITE_URL: PUBLIC_ORIGIN,
  PUBLIC_APP_URL: APP_ORIGIN,
};

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

// Phase 2 of the app-subdomain migration (ADR-0010, Workstream Q):
// app.crawlpact.com must never be crawled and must never carry a Sitemap
// line — it owns no public/indexable content at all.
describe("app-host robots.txt (Phase 2, ADR-0010)", () => {
  const content = APP_ROBOTS_TXT;

  it("disallows crawling entirely", () => {
    expect(content).toMatch(/User-agent: \*\s*\n\s*Disallow: \/\s*$/);
  });

  it("declares no sitemap", () => {
    expect(content).not.toContain("Sitemap:");
  });
});

describe("GET /robots.txt dispatches by host, not just environment", () => {
  it("serves PRODUCTION_ROBOTS_TXT for a request arriving on the public origin", async () => {
    mockEnv = {
      PUBLIC_APP_ENV: "production",
      PUBLIC_SITE_URL: PUBLIC_ORIGIN,
      PUBLIC_APP_URL: APP_ORIGIN,
    };
    const response = await GET({ request: new Request(`${PUBLIC_ORIGIN}/robots.txt`) } as never);
    expect(await response.text()).toBe(PRODUCTION_ROBOTS_TXT);
  });

  it("serves APP_ROBOTS_TXT for a request arriving on the app origin", async () => {
    mockEnv = {
      PUBLIC_APP_ENV: "production",
      PUBLIC_SITE_URL: PUBLIC_ORIGIN,
      PUBLIC_APP_URL: APP_ORIGIN,
    };
    const response = await GET({ request: new Request(`${APP_ORIGIN}/robots.txt`) } as never);
    expect(await response.text()).toBe(APP_ROBOTS_TXT);
  });

  it("serves PREVIEW_ROBOTS_TXT on preview regardless of which host the request claims", async () => {
    mockEnv = {
      PUBLIC_APP_ENV: "preview",
      PUBLIC_SITE_URL: "https://preview.crawlpact.com",
      PUBLIC_APP_URL: "https://app-preview.crawlpact.com",
    };
    const response = await GET({
      request: new Request("https://app-preview.crawlpact.com/robots.txt"),
    } as never);
    expect(await response.text()).toBe(PREVIEW_ROBOTS_TXT);
  });
});
