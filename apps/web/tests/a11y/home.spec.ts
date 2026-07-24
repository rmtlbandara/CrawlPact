import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility smoke tests (SRS §35.5, Step 14; expanded Part 3 Step 17).
 * This is intentionally a fast set of automated axe-core scans covering
 * one representative page per distinct template/archetype in the public
 * site — not a substitute for manual keyboard/screen-reader review, which
 * remains tracked in docs/design/ACCESSIBILITY_REQUIREMENTS.md's "Known
 * gaps" section.
 */
const ROUTES = [
  "/",
  "/about",
  "/audit",
  "/pricing",
  "/crawlers",
  "/crawlers/amazonbot",
  "/tools",
  "/tools/ai-crawler-checker",
  "/guides",
  "/guides/applebot-vs-applebot-extended",
  "/methodology",
  "/scoring",
  "/scanner",
  "/changelog",
  "/status",
  "/security",
  "/privacy",
  "/terms",
  "/acceptable-use",
  "/limitations",
  "/sign-in",
  "/this-page-does-not-exist", // renders 404.astro
];

for (const route of ROUTES) {
  test(`${route} has no automatically detectable WCAG 2.2 AA violations`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}

test("reduced-motion preference is respected on the home page", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("skip link is the first focusable element and moves focus to main content", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("breadcrumb navigation on a guide page is a labelled landmark with correct current-page state", async ({
  page,
}) => {
  await page.goto("/guides/applebot-vs-applebot-extended");
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(breadcrumb).toBeVisible();
  await expect(breadcrumb.getByText("Guides")).toHaveAttribute("href", "/guides");
  await expect(breadcrumb.locator('[aria-current="page"]')).toBeVisible();
});
