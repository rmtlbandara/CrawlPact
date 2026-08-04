import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Source-inspection tests for the Phase 4 homepage section components — there is no Astro
 * component-rendering harness in this repo (see `apps/web/src/lib/robots-txt.test.ts` and
 * `apps/web/src/layouts/base-layout-brand.test.ts` for the same approach used elsewhere).
 * Guards against accidental heading-hierarchy regressions and prohibited-claim reintroduction.
 */

function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf-8");
}

describe("RiskSection.astro", () => {
  const content = read("./RiskSection.astro");

  it("has exactly one H2 and three risk H3s", () => {
    expect(content.match(/<h2/g)?.length).toBe(1);
    expect(content.match(/<h3/g)?.length).toBe(1); // template literal, rendered once per risk at runtime
  });

  it("does not claim every website needs the same policy", () => {
    expect(content).toContain("Not every website needs the same policy");
  });
});

describe("CrawlerPurposeSection.astro", () => {
  const content = read("./CrawlerPurposeSection.astro");

  it("covers all four required crawler purposes", () => {
    for (const purpose of ["Search", "Training", "User-triggered retrieval", "Agents"]) {
      expect(content).toContain(purpose);
    }
  });

  it("links to the crawler directory", () => {
    expect(content).toContain('href="/crawlers"');
  });
});

describe("AgencySection.astro", () => {
  const content = read("./AgencySection.astro");
  // Only the rendered template (after Astro's `---` frontmatter fence) is checked here — the
  // frontmatter's own JSDoc comment explains *why* these are absent, which legitimately names
  // them, the same negation pattern already allowlisted for brand/trust validators elsewhere.
  const template = content.split(/^---$/m).slice(2).join("---");

  it("does not claim client portal, team-role, or ownership-verification functionality", () => {
    expect(template).not.toMatch(/client portal/i);
    expect(template).not.toMatch(/team role/i);
    expect(template).not.toMatch(/verif(y|ies|ied) (domain )?ownership/i);
  });

  it("has an Agency-pricing CTA and a sample-report CTA", () => {
    expect(content).toContain("Review Agency pricing");
    expect(content).toContain("/sample-report");
  });
});

describe("PricingPreviewSection.astro", () => {
  const content = read("./PricingPreviewSection.astro");

  it("takes plans as a prop rather than hardcoding pricing", () => {
    expect(content).toContain("export type Props = { plans: Plan[] }");
    expect(content).not.toMatch(/USD \d/);
  });

  it("links each plan CTA to the full pricing page", () => {
    expect(content).toContain("href={`/pricing#${plan.id}`}");
  });
});

describe("SampleReportSection.astro", () => {
  const content = read("./SampleReportSection.astro");

  it("reads its featured finding from the same fixture the full sample-report page renders", () => {
    expect(content).toContain('import { SAMPLE_REPORT } from "../../lib/sample-report.fixture"');
  });

  it("clearly labels the preview as illustrative, not a real scan", () => {
    expect(content).toContain("not a real scan result");
  });
});
