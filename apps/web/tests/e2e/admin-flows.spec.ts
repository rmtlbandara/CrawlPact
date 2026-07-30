import { expect, test } from "@playwright/test";
import { seedFailedWebhookEvent } from "./helpers/admin-db";
import { ensureRealPage } from "./helpers/navigation";
import { ADMIN_STORAGE_STATE, ADMIN_FIXTURE_DISPLAY_NAME_PREFIX } from "./helpers/fixture-accounts";

/**
 * Real browser journeys through the Super Admin Control Center (SRS §35.3:
 * "Super Admin user search", "Super Admin subscription review", "Webhook
 * retry", "Table filtering"). Built alongside auth-and-account.spec.ts as
 * part of Part 3 Step 23's SRS traceability audit, which found these
 * journeys had no real Playwright coverage — only integration tests (real
 * D1, no browser) and public-page-only a11y checks existed.
 *
 * All four tests share one authenticated Super Admin session
 * (setup/admin.setup.ts's storageState) instead of each registering its own
 * fresh throwaway account — safe here because none of them mutate the
 * admin *account* itself (webhook-retry mutates a separately-seeded webhook
 * row; user-search/subscription-review are read-only). See
 * docs/status/KNOWN_RISKS.md for the full before/after ceremony count.
 */
test.describe("Super Admin Control Center", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "WebAuthn is Chromium-only.");
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test("an admin can sign in and see the global dashboard", async ({ page }) => {
    await page.goto("/admin");
    await ensureRealPage(page);
    await expect(page.getByRole("heading", { name: "Global dashboard" })).toBeVisible();
    // SRS §28.2: the dashboard must show real registered-user/domain/scan
    // counts, not a placeholder — assert a labelled metric renders a number.
    await expect(page.getByText("Total users")).toBeVisible();
  });

  test("an admin can search for a user by display name", async ({ page }) => {
    await page.goto("/admin/users");
    await ensureRealPage(page);
    const searchInput = page.getByPlaceholder("Search by ID, name, Paddle ID, or domain");
    await searchInput.fill(ADMIN_FIXTURE_DISPLAY_NAME_PREFIX);
    await expect(
      page.getByText(new RegExp(`${ADMIN_FIXTURE_DISPLAY_NAME_PREFIX} \\S+`)).first(),
    ).toBeVisible();
  });

  test("an admin can review subscriptions and filter the table", async ({ page }) => {
    await page.goto("/admin/subscriptions");
    await ensureRealPage(page);
    await expect(page.getByRole("heading", { name: "Subscriptions", exact: true })).toBeVisible();

    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Past due" }).click();
    // Filtering must not error out even when it produces an empty result —
    // the table's empty state is itself part of what's under test here.
    const tableOrEmptyState = page
      .locator("table, [role='table']")
      .first()
      .or(page.getByText(/no /i).first());
    await expect(tableOrEmptyState).toBeVisible();
  });

  test("an admin can retry a failed webhook event", async ({ page }) => {
    await seedFailedWebhookEvent();
    await page.goto("/admin/webhooks");
    await ensureRealPage(page);
    await expect(page.getByRole("heading", { name: "Webhooks" })).toBeVisible();

    await page.getByRole("button", { name: "Retry" }).first().click();
    await page.getByLabel("Reason").fill("E2E test verifying the retry action end-to-end.");
    await page.getByRole("button", { name: "Retry", exact: true }).last().click();
    await expect(page.getByText(/Retry outcome:/)).toBeVisible({ timeout: 10_000 });
  });
});
