import { expect, test } from "@playwright/test";

/**
 * Two automated checks the existing a11y suite didn't cover:
 *
 * 1. Forced-colors mode (Windows High Contrast Mode emulation, WCAG 1.4.11-
 *    adjacent). This design system relies on `focus-visible:outline` (not
 *    `box-shadow`) for focus rings specifically because outlines survive
 *    forced-colors while box-shadows are stripped — this test proves that
 *    choice actually holds under the real media feature, not just in code
 *    review.
 * 2. Reflow at 400% zoom (WCAG 1.4.10). Per the WCAG technique, 400% zoom
 *    on a 1280px viewport is equivalent to a 320px CSS-pixel viewport —
 *    content must not require horizontal scrolling at that width.
 *
 * Neither replaces a human running an actual screen reader — see
 * docs/design/EVIDENCE_OBSERVATORY_REDESIGN_SPEC.md §12 for that
 * still-open gap.
 */
const REPRESENTATIVE_ROUTES = [
  "/",
  "/audit",
  "/pricing",
  "/crawlers/amazonbot",
  "/guides/applebot-vs-applebot-extended",
  "/sign-in",
];

test.describe("forced-colors mode", () => {
  // Synthetic Tab-key focus is unreliable under WebKit's mobile-device
  // emulation in this Playwright setup — the same known tooling limitation
  // already documented in docs/status/KNOWN_RISKS.md for the skip-link
  // focus test, not a real defect in the page. Real Safari on a real
  // keyboard is unaffected; this check stays on chromium, matching that
  // existing precedent.
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Known WebKit mobile-emulation Tab-focus limitation.",
  );

  for (const route of REPRESENTATIVE_ROUTES) {
    test(`${route} keeps a visible keyboard-focus indicator under forced-colors`, async ({
      page,
    }) => {
      await page.emulateMedia({ forcedColors: "active" });
      await page.goto(route);
      await page.keyboard.press("Tab");
      const focused = page.locator(":focus");
      await expect(focused).toBeVisible();
      const outlineStyle = await focused.evaluate((el) => getComputedStyle(el).outlineStyle);
      expect(outlineStyle).not.toBe("none");
    });
  }
});

test.describe("400% zoom reflow (WCAG 1.4.10)", () => {
  for (const route of REPRESENTATIVE_ROUTES) {
    test(`${route} has no horizontal scrolling at a 320px effective viewport`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 690 });
      await page.goto(route);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(
        scrollWidth,
        `scrollWidth (${scrollWidth}) should not exceed clientWidth (${clientWidth})`,
      ).toBeLessThanOrEqual(
        clientWidth + 1, // 1px tolerance for sub-pixel rounding
      );
    });
  }
});
