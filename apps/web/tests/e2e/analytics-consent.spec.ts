import { expect, test } from "@playwright/test";
import { CUSTOMER_STORAGE_STATE, ADMIN_STORAGE_STATE } from "./helpers/fixture-accounts";

/**
 * Phase 13 (RISK-020/RISK-021). Real-browser proof that Google Analytics
 * and the consent banner never load outside production, and never load on
 * authenticated/admin pages regardless of environment.
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
test.describe("Google Analytics and the consent banner never load outside production", () => {
  test("homepage: no googletagmanager.com script and no consent banner in a non-production environment", async ({
    page,
  }) => {
    await page.goto("/");
    const gaScripts = await page.locator('script[src*="googletagmanager.com"]').count();
    expect(gaScripts).toBe(0);
    await expect(page.getByRole("region", { name: "Analytics preferences" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Analytics preferences" })).toHaveCount(0);
  });

  test("pricing page: no GA script tag", async ({ page }) => {
    await page.goto("/pricing");
    const gaScripts = await page.locator('script[src*="googletagmanager.com"]').count();
    expect(gaScripts).toBe(0);
  });
});

test.describe("Google Analytics never loads on authenticated or admin pages", () => {
  test.use({ storageState: CUSTOMER_STORAGE_STATE });

  test("authenticated app dashboard: no GA script, no consent banner", async ({ page }) => {
    await page.goto("/app");
    const gaScripts = await page.locator('script[src*="googletagmanager.com"]').count();
    expect(gaScripts).toBe(0);
    await expect(page.getByRole("region", { name: "Analytics preferences" })).toHaveCount(0);
  });
});

test.describe("Google Analytics never loads on Super Admin pages", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test("admin analytics dashboard: no GA script, no consent banner", async ({ page }) => {
    await page.goto("/admin/analytics");
    const gaScripts = await page.locator('script[src*="googletagmanager.com"]').count();
    expect(gaScripts).toBe(0);
    await expect(page.getByRole("region", { name: "Analytics preferences" })).toHaveCount(0);
  });
});

test.describe("Private/low-value marketing routes are excluded from the GA allowlist", () => {
  test("sign-in page: no GA script even though it renders inside MarketingLayout", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    const gaScripts = await page.locator('script[src*="googletagmanager.com"]').count();
    expect(gaScripts).toBe(0);
  });
});
