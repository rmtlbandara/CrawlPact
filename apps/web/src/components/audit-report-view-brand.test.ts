import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Source-inspection tests (no React rendering harness exists in this repo, same approach as
 * base-layout-brand.test.ts for Astro) proving the shared `AuditReportView` — used by every
 * report surface (/audit/[auditId], /sample-report, /shared/[token], the domain workspace) —
 * renders the current shield/checkmark brand mark, not the historical C-bracket SVG this file
 * used to inline. See docs/brand/BRAND_ASSET_USAGE_INVENTORY.md.
 */
describe("AuditReportView report-header brand consistency", () => {
  const viewPath = fileURLToPath(new URL("./AuditReportView.tsx", import.meta.url));
  const content = readFileSync(viewPath, "utf-8");

  it("imports and renders the shared BrandMark component in the report header", () => {
    expect(content).toContain('import { BrandMark } from "./BrandMark"');
    expect(content).toMatch(/<BrandMark className="size-6 shrink-0" \/>/);
  });

  it("no longer contains the historical C-bracket logo SVG geometry", () => {
    expect(content).not.toMatch(/M21 9h-8/);
    expect(content).not.toMatch(/M12 16h11/);
    expect(content).not.toMatch(/23\.2.*14\.4/);
  });

  it("the report header's brand mark is not inside a .no-print element", () => {
    const headerBlockMatch = content.match(
      /<div className="flex items-center gap-2">\s*<BrandMark[\s\S]*?<\/div>/,
    );
    expect(headerBlockMatch).not.toBeNull();
    expect(headerBlockMatch![0]).not.toContain("no-print");
  });

  it("every report surface renders through this same shared component, not a duplicate implementation", () => {
    const reportPages = [
      "../pages/sample-report.astro",
      "../pages/audit/[auditId].astro",
      "../pages/shared/[token].astro",
      "../pages/app/domains/[domainId].astro",
    ];
    for (const relPath of reportPages) {
      const pageContent = readFileSync(fileURLToPath(new URL(relPath, import.meta.url)), "utf-8");
      expect(pageContent).toContain('from "');
      expect(pageContent).toMatch(/AuditReportView/);
    }
  });
});

describe("BrandMark.tsx (React) matches BrandMark.astro (Astro) canonical asset", () => {
  const reactMark = readFileSync(
    fileURLToPath(new URL("./BrandMark.tsx", import.meta.url)),
    "utf-8",
  );
  const astroMark = readFileSync(
    fileURLToPath(new URL("./BrandMark.astro", import.meta.url)),
    "utf-8",
  );

  it("both use the same canonical icon asset path", () => {
    expect(reactMark).toContain("/branding/crawlpact-icon.webp");
    expect(astroMark).toContain("/branding/crawlpact-icon.webp");
  });

  it("both are decorative — empty alt text and aria-hidden, no redundant screen-reader text", () => {
    expect(reactMark).toContain('alt=""');
    expect(reactMark).toContain("aria-hidden");
    expect(astroMark).toContain('alt=""');
    expect(astroMark).toContain("aria-hidden");
  });
});
