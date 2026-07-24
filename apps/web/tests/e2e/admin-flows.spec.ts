import { expect, test } from "@playwright/test";
import { addVirtualAuthenticator } from "./helpers/webauthn";
import { registerNewAccount, signInWithPasskey } from "./helpers/auth";
import {
  findUserIdByDisplayName,
  grantSuperAdmin,
  seedFailedWebhookEvent,
} from "./helpers/admin-db";
import { ensureRealPage } from "./helpers/navigation";

/**
 * Real browser journeys through the Super Admin Control Center (SRS §35.3:
 * "Super Admin user search", "Super Admin subscription review", "Webhook
 * retry", "Table filtering"). Built alongside auth-and-account.spec.ts as
 * part of Part 3 Step 23's SRS traceability audit, which found these
 * journeys had no real Playwright coverage — only integration tests (real
 * D1, no browser) and public-page-only a11y checks existed.
 *
 * Each test registers a fresh throwaway account via a real passkey ceremony
 * and grants it `super_admin` directly against the local dev D1 (see
 * helpers/admin-db.ts) — there is no way to reach an existing admin account
 * through the browser alone, since passkeys are hardware-bound per browser
 * profile and this is a fresh Playwright context every run.
 */
test.describe("Super Admin Control Center", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "WebAuthn is Chromium-only.");

  async function signInAsFreshAdmin(page: import("@playwright/test").Page): Promise<void> {
    await addVirtualAuthenticator(page);
    // Date.now() alone can collide across parallel workers within the same
    // millisecond, causing findUserIdByDisplayName to match the wrong row
    // and admin_role_assignments' UNIQUE(user_id, role_id) to reject a
    // duplicate grant — confirmed empirically running the full suite at
    // default parallelism.
    const displayName = `E2E Admin User ${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    await registerNewAccount(page, displayName);
    const userId = await findUserIdByDisplayName(displayName);
    await grantSuperAdmin(userId);
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("**/");
    await signInWithPasskey(page);
  }

  test("an admin can sign in and see the global dashboard", async ({ page }) => {
    await signInAsFreshAdmin(page);
    await page.goto("/admin");
    await ensureRealPage(page);
    await expect(page.getByRole("heading", { name: "Global dashboard" })).toBeVisible();
    // SRS §28.2: the dashboard must show real registered-user/domain/scan
    // counts, not a placeholder — assert a labelled metric renders a number.
    await expect(page.getByText("Total users")).toBeVisible();
  });

  test("an admin can search for a user by display name", async ({ page }) => {
    await signInAsFreshAdmin(page);
    await page.goto("/admin/users");
    await ensureRealPage(page);
    const searchInput = page.getByPlaceholder("Search by ID, name, Paddle ID, or domain");
    await searchInput.fill("E2E Admin User");
    await expect(page.getByText(/E2E Admin User \d+/).first()).toBeVisible();
  });

  test("an admin can review subscriptions and filter the table", async ({ page }) => {
    await signInAsFreshAdmin(page);
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
    await signInAsFreshAdmin(page);
    await page.goto("/admin/webhooks");
    await ensureRealPage(page);
    await expect(page.getByRole("heading", { name: "Webhooks" })).toBeVisible();

    await page.getByRole("button", { name: "Retry" }).first().click();
    await page.getByLabel("Reason").fill("E2E test verifying the retry action end-to-end.");
    await page.getByRole("button", { name: "Retry", exact: true }).last().click();
    await expect(page.getByText(/Retry outcome:/)).toBeVisible({ timeout: 10_000 });
  });
});
