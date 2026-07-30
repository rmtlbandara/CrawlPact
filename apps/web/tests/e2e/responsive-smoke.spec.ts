import { expect, test, type Page } from "@playwright/test";
import { CUSTOMER_STORAGE_STATE, ADMIN_STORAGE_STATE } from "./helpers/fixture-accounts";

/**
 * Replaces the deleted pixel-by-pixel visual regression suite (see
 * docs/architecture/adr/ADR-0008-remove-pixel-visual-regression.md). Asserts
 * real responsive behaviour — no horizontal overflow, key content reachable,
 * mobile nav usable — at the three SRS breakpoints, instead of screenshot
 * equality. These assertions fail only on actual broken layout, not on font
 * rendering or anti-aliasing differences between platforms.
 */

const VIEWPORTS = [
  { name: "360", width: 360, height: 800 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 900 },
];

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  // Allow 1px of rounding slop from subpixel layout; a real overflow bug
  // shows up as tens/hundreds of pixels, not a rounding error.
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("Responsive layout smoke", () => {
  for (const viewport of VIEWPORTS) {
    test.describe(`at ${viewport.width}px`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test("home page renders the audit form without horizontal overflow", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.getByRole("button", { name: "Audit domain" }).first()).toBeVisible();
        await assertNoHorizontalOverflow(page);
      });

      test("pricing page renders its plans without horizontal overflow", async ({ page }) => {
        await page.goto("/pricing");
        await page.waitForLoadState("networkidle");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await assertNoHorizontalOverflow(page);
      });

      test("a crawler detail page renders without horizontal overflow", async ({ page }) => {
        await page.goto("/crawlers/gptbot");
        await page.waitForLoadState("networkidle");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await assertNoHorizontalOverflow(page);
      });

      // MobileNav.tsx is `xl:hidden` — this project's remapped `xl:`
      // breakpoint is 1024px (see SiteHeader.astro), so the "Open menu"
      // button is present at both 360 and 768, hidden only at 1280.
      if (viewport.width < 1024) {
        test("mobile navigation opens and closes without leaving stray horizontal overflow", async ({
          page,
        }) => {
          await page.goto("/");
          await page.waitForLoadState("networkidle");
          await page.getByRole("button", { name: "Open menu" }).click();
          const dialog = page.getByRole("dialog");
          await expect(dialog).toBeVisible();
          await assertNoHorizontalOverflow(page);
          await page.getByRole("button", { name: "Close panel" }).click();
          await expect(dialog).toBeHidden();
        });
      }
    });
  }

  // Both tests below reuse the shared customer/admin fixtures (see
  // setup/customer.setup.ts, setup/admin.setup.ts) instead of registering a
  // fresh passkey — safe here since both are read-only render checks.
  test.describe("authenticated shells", () => {
    test.skip(({ browserName }) => browserName !== "chromium", "WebAuthn is Chromium-only.");

    test.describe("customer dashboard", () => {
      test.use({ storageState: CUSTOMER_STORAGE_STATE });

      test("renders without horizontal overflow", async ({ page }) => {
        for (const viewport of VIEWPORTS) {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await page.goto("/app");
          await page.waitForLoadState("networkidle");
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await assertNoHorizontalOverflow(page);
        }
      });
    });

    test.describe("Super Admin shell", () => {
      test.use({ storageState: ADMIN_STORAGE_STATE });

      test("renders without horizontal overflow", async ({ page }) => {
        for (const viewport of VIEWPORTS) {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await page.goto("/admin/settings");
          await page.waitForLoadState("networkidle");
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await assertNoHorizontalOverflow(page);
        }
      });
    });
  });

  test("keyboard focus is visible when tabbing from the top of the home page", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Tab");
    const focusIsVisible = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return false;
      const style = window.getComputedStyle(el);
      return style.outlineStyle !== "none" || style.boxShadow !== "none";
    });
    expect(focusIsVisible).toBe(true);
  });
});
