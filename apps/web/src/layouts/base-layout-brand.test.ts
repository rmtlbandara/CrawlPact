import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Asserts on the actual source of `BaseLayout.astro` — the single place that renders every
 * page's `<title>`, meta description, Open Graph tags, and sitewide JSON-LD. There is no Astro
 * component-rendering harness in this repo (see `apps/web/src/lib/robots-txt.test.ts` for the
 * same source-inspection approach used elsewhere), so this guards against regressing back to a
 * hardcoded product name/description instead of the centralised `BRAND` config.
 */
describe("BaseLayout.astro brand/structured-data consistency", () => {
  const layoutPath = fileURLToPath(new URL("./BaseLayout.astro", import.meta.url));
  const content = readFileSync(layoutPath, "utf-8");

  it("imports the central brand config", () => {
    expect(content).toContain('import { BRAND } from "../config/brand"');
  });

  it("uses BRAND for the Organization/WebSite JSON-LD name and og:site_name, not a hardcoded string", () => {
    expect(content).toMatch(/name:\s*BRAND\.productName/);
    expect(content).toContain("content={BRAND.productName}");
    expect(content).not.toMatch(/name:\s*"CrawlPact"/);
    expect(content).not.toContain('og:site_name" content="CrawlPact"');
  });

  it("uses BRAND for the Organization description, not the stale hardcoded phrase", () => {
    expect(content).toMatch(/description:\s*BRAND\.descriptions\.medium/);
    expect(content).not.toContain("AI Crawler Policy Auditor & Monitor");
  });
});
