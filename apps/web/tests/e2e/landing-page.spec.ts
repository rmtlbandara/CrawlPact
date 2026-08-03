import { expect, test } from "@playwright/test";
import { retryUntilSettled } from "./helpers/hydration";

test.describe("Landing page", () => {
  test("shows the hero audit form in the first viewport without requiring an account", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Audit and monitor");
    await expect(page.getByRole("button", { name: "Audit a domain" }).first()).toBeVisible();
  });

  // The honest "AUDIT_ENGINE_DISABLED" response (never a fabricated result)
  // when the engine is off is exercised by audit-api.integration.test.ts,
  // not here — e2e now runs with a live engine (see ci.yml's e2e-and-a11y
  // job) so the auth/domain/scan/admin journeys in auth-and-account.spec.ts
  // and admin-flows.spec.ts can exercise a real scan end-to-end.

  test("rejects obviously invalid input before any network call", async ({ page }) => {
    await page.goto("/");
    const input = page.getByLabel("Domain or URL to audit").first();
    // AuditForm is a `client:load` island — a submit before it hydrates has
    // no effect, so retry against the concrete effect (the validation
    // alert appearing) instead of an indirect `networkidle` wait.
    await retryUntilSettled(async () => {
      await input.fill("javascript:alert(1)");
      await page.getByRole("button", { name: "Audit a domain" }).first().click();
      await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 1_000 });
    });
  });

  test("mobile navigation menu opens and closes", async ({ page, isMobile }) => {
    await page.goto("/");
    if (!isMobile) return;
    // MobileNav hydrates as a `client:idle` React island (see SiteHeader.astro) —
    // a click before it attaches its handler has no effect, so retry
    // against the concrete effect (the dialog opening) instead of an
    // indirect `networkidle` wait.
    await retryUntilSettled(async () => {
      await page.getByRole("button", { name: "Open menu" }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 });
    });
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
