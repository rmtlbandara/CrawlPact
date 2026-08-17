import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * RISK-033 (Lighthouse investigation, 2026-08-17): AnalyticsConsent used to
 * hardcode `hasDecided = true` on both server-render and initial client
 * hydration, only discovering the real cookie state inside a post-hydration
 * `useEffect`. For a fresh visitor (no cookie — exactly a clean Lighthouse
 * profile), the banner was invisible at first paint and popped in ~2-3s
 * later. On pages with sparse above-the-fold content (e.g. /sample-report)
 * that delayed reveal became the LCP element once Lighthouse's
 * `--throttling-method=devtools` (real network replay) replaced its default
 * simulated timing, which had been masking it. Fix: MarketingLayout.astro
 * already reads the real cookie server-side (`Astro.cookies`) for the GA
 * gating decision — pass that same value through as an initial prop so the
 * very first render (SSR and hydration alike) already reflects reality.
 * No component-rendering harness exists in this repo (source-inspection is
 * the established pattern — see ga-boundary.test.ts), so this asserts on
 * the actual source rather than mounting the component.
 */
function readSource(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf-8");
}

describe("AnalyticsConsent initial state is real, not a hardcoded default (RISK-033)", () => {
  it("AnalyticsConsent.tsx initializes hasDecided from a prop, not a hardcoded literal", () => {
    const content = readSource("./AnalyticsConsent.tsx");
    expect(content).toMatch(/initialConsentState:\s*AnalyticsConsentState \| null/);
    expect(content).toContain("useState(initialConsentState !== null)");
    // The old regression this guards against: a bare `useState(true)` default
    // with no relationship to any prop.
    expect(content).not.toMatch(/useState<AnalyticsConsentState \| null>\(null\)/);
    expect(content).not.toMatch(/const \[hasDecided, setHasDecided\] = useState\(true\)/);
  });

  it("MarketingLayout.astro passes the server-read consentState through to AnalyticsConsent", () => {
    const content = readSource("../layouts/MarketingLayout.astro");
    expect(content).toContain("const consentState = parseConsentCookieValue(");
    expect(content).toMatch(/<AnalyticsConsent[\s\S]*?initialConsentState=\{consentState\}/);
  });
});
