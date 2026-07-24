import { expect, test } from "@playwright/test";

test.describe("Landing page", () => {
  test("shows the hero audit form in the first viewport without requiring an account", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Audit and monitor");
    await expect(page.getByRole("button", { name: "Audit domain" }).first()).toBeVisible();
  });

  // The honest "AUDIT_ENGINE_DISABLED" response (never a fabricated result)
  // when the engine is off is exercised by audit-api.integration.test.ts,
  // not here — e2e now runs with a live engine (see ci.yml's e2e-and-a11y
  // job) so the auth/domain/scan/admin journeys in auth-and-account.spec.ts
  // and admin-flows.spec.ts can exercise a real scan end-to-end.

  test("rejects obviously invalid input before any network call", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const input = page.getByLabel("Domain or URL to audit").first();
    await input.fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Audit domain" }).first().click();
    await expect(page.getByRole("alert").first()).toBeVisible();
  });

  test("mobile navigation menu opens and closes", async ({ page, isMobile }) => {
    await page.goto("/");
    if (!isMobile) return;
    // MobileNav hydrates as a `client:idle` React island (see SiteHeader.astro) —
    // wait for hydration before clicking, same race as the audit-form tests above.
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close panel" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("site chrome is hidden in print media (SRS §10.30 print-ready reports)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("header").first()).toBeHidden();
    await expect(page.locator("footer").first()).toBeHidden();
  });
});
