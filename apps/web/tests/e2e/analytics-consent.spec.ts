import { expect, test } from "@playwright/test";
import { CUSTOMER_STORAGE_STATE, ADMIN_STORAGE_STATE } from "./helpers/fixture-accounts";

/**
 * Phase 13 (RISK-020/RISK-021). Real-browser proof that Google Analytics
 * and the consent banner never load outside production, and never load on
 * authenticated/admin pages regardless of environment. Phase 22 extends
 * every check here to Microsoft Clarity too — `MarketingLayout.astro`'s
 * `shouldRenderClarity` is deliberately the same boolean as `shouldRenderGa`
 * (see that file), so anywhere GA is proven absent, Clarity must be too.
 *
 * This suite always runs with `PUBLIC_APP_ENV=local` (ci.yml's
 * `browser-smoke` job, playwright.config.ts's dev-server webServer) — the
 * same gate that keeps GA off local/preview traffic
 * (`MarketingLayout.astro`'s `isProduction` check) also means the
 * AnalyticsConsent banner itself cannot be exercised end-to-end here: it
 * only mounts when `isProduction` is true. That's a real, disclosed
 * limitation, not an oversight — see
 * docs/analytics/CONSENT_AND_ANALYTICS_PREFERENCE_MODEL.md "Verification"
 * for how the interactive accept/decline/revoke journeys are covered
 * instead (apps/web/src/lib/consent.test.ts,
 * apps/web/src/layouts/ga-boundary.test.ts by source inspection, and
 * scripts/smoke-test.ts's production-only checks post-deploy).
 */
function countGaScripts(page: import("@playwright/test").Page) {
  return page.locator('script[src*="googletagmanager.com"]').count();
}

function countClarityScripts(page: import("@playwright/test").Page) {
  return page.locator('script[src*="clarity.ms"]').count();
}

test.describe("Google Analytics and the consent banner never load outside production", () => {
  test("homepage: no googletagmanager.com/clarity.ms script and no consent banner in a non-production environment", async ({
    page,
  }) => {
    await page.goto("/");
    expect(await countGaScripts(page)).toBe(0);
    expect(await countClarityScripts(page)).toBe(0);
    await expect(page.getByRole("region", { name: "Analytics preferences" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Analytics preferences" })).toHaveCount(0);
  });

  test("pricing page: no GA or Clarity script tag", async ({ page }) => {
    await page.goto("/pricing");
    expect(await countGaScripts(page)).toBe(0);
    expect(await countClarityScripts(page)).toBe(0);
  });
});

test.describe("Google Analytics never loads on authenticated or admin pages", () => {
  test.use({ storageState: CUSTOMER_STORAGE_STATE });

  test("authenticated app dashboard: no GA or Clarity script, no consent banner", async ({
    page,
  }) => {
    await page.goto("/app");
    expect(await countGaScripts(page)).toBe(0);
    expect(await countClarityScripts(page)).toBe(0);
    await expect(page.getByRole("region", { name: "Analytics preferences" })).toHaveCount(0);
  });
});

test.describe("Google Analytics never loads on Super Admin pages", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test("admin analytics dashboard: no GA or Clarity script, no consent banner", async ({
    page,
  }) => {
    await page.goto("/admin/analytics");
    expect(await countGaScripts(page)).toBe(0);
    expect(await countClarityScripts(page)).toBe(0);
    await expect(page.getByRole("region", { name: "Analytics preferences" })).toHaveCount(0);
  });
});

test.describe("Private/low-value marketing routes are excluded from the GA allowlist", () => {
  test("sign-in page: no GA or Clarity script even though it renders inside MarketingLayout", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    expect(await countGaScripts(page)).toBe(0);
    expect(await countClarityScripts(page)).toBe(0);
  });
});
