import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * RISK-020 / RISK-021 acceptance criteria: a test must assert that
 * GoogleAnalytics/gtag never appears in authenticated-app or admin server
 * output, and that GA on marketing pages is structurally gated on both route
 * eligibility and granted consent. There is no Astro component-rendering
 * harness in this repo (see `apps/web/src/layouts/base-layout-brand.test.ts`
 * for the same source-inspection approach used elsewhere), so this asserts
 * on the actual source of every layout that can render a page.
 */
function readLayout(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf-8");
}

describe("Google Analytics never reaches authenticated/admin output", () => {
  it("AppLayout.astro never imports GoogleAnalytics or references gtag/googletagmanager", () => {
    const content = readLayout("AppLayout.astro");
    expect(content).not.toMatch(/GoogleAnalytics/);
    expect(content).not.toMatch(/gtag/i);
    expect(content).not.toMatch(/googletagmanager\.com/);
  });

  it("AdminLayout.astro never imports GoogleAnalytics or references gtag/googletagmanager", () => {
    const content = readLayout("AdminLayout.astro");
    expect(content).not.toMatch(/GoogleAnalytics/);
    expect(content).not.toMatch(/gtag/i);
    expect(content).not.toMatch(/googletagmanager\.com/);
  });

  it("BaseLayout.astro (shared by every layout) never itself renders GoogleAnalytics", () => {
    const content = readLayout("BaseLayout.astro");
    expect(content).not.toMatch(/GoogleAnalytics/);
    expect(content).not.toMatch(/gtag/i);
    expect(content).not.toMatch(/googletagmanager\.com/);
  });
});

describe("MarketingLayout.astro gates GoogleAnalytics on route eligibility and granted consent", () => {
  const content = readLayout("MarketingLayout.astro");

  it("only renders GoogleAnalytics behind a computed shouldRenderGa flag, never unconditionally", () => {
    expect(content).toMatch(/\{shouldRenderGa\s*&&\s*<GoogleAnalytics\s*\/>\}/);
  });

  it("computes shouldRenderGa from route eligibility, granted consent, and production, not from consent alone", () => {
    const match = /const shouldRenderGa\s*=\s*([^;]+);/.exec(content);
    expect(match).not.toBeNull();
    const expression = match?.[1] ?? "";
    expect(expression).toMatch(/isProduction/);
    expect(expression).toMatch(/gaEligible/);
    expect(expression).toMatch(/consentState\s*===\s*"granted"/);
  });

  it("derives gaEligible from the shared isGaEligibleRoute allowlist, not an inline route check", () => {
    expect(content).toMatch(
      /import\s*\{[^}]*isGaEligibleRoute[^}]*\}\s*from\s*"\.\.\/lib\/consent"/,
    );
    expect(content).toMatch(/const gaEligible\s*=\s*isGaEligibleRoute\(/);
  });
});
