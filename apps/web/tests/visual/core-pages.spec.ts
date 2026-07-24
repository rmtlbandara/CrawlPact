import { expect, test } from "@playwright/test";

/**
 * Visual regression baseline for SRS §10.56/§10.57 ("core pages pass visual
 * regression tests"), across the seven required breakpoints (defined as
 * separate projects in playwright.visual.config.ts). Run explicitly via
 * `pnpm test:visual` — excluded from `test:e2e` so unrelated PRs don't flake
 * on pixel diffs. See docs/testing/VISUAL_QA_MATRIX.md.
 *
 * Expanded in Part 3 Step 18 to cover one representative page per remaining
 * distinct template (breadcrumb pages, the 20-item guide/crawler index list
 * layouts, the DB-driven changelog, and the 404 page) — not just the
 * original six core public routes.
 */
const ROUTES = [
  { name: "home", path: "/" },
  { name: "about", path: "/about" },
  { name: "audit", path: "/audit" },
  { name: "pricing", path: "/pricing" },
  { name: "crawlers", path: "/crawlers" },
  { name: "crawler-detail", path: "/crawlers/gptbot" },
  { name: "guides", path: "/guides" },
  { name: "guide-detail", path: "/guides/how-to-publish-an-llms-txt-file" },
  { name: "tools", path: "/tools" },
  { name: "tool-detail", path: "/tools/content-signals-checker" },
  { name: "methodology", path: "/methodology" },
  { name: "changelog", path: "/changelog" },
  { name: "not-found", path: "/this-page-does-not-exist" },
];

for (const { name, path } of ROUTES) {
  test(`${name} (${path}) matches its visual baseline`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      animations: "disabled",
    });
  });
}
