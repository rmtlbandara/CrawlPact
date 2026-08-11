import { expect, test } from "@playwright/test";
import { ensureRealPage } from "./helpers/navigation";
import { ADMIN_STORAGE_STATE } from "./helpers/fixture-accounts";

/**
 * Phase 14: real browser coverage for the new Super Admin operations
 * control plane (`/admin/operations`) and the new public status Atom feed
 * (`/status/feed.xml`) — both built this phase.
 */
test.describe("Super Admin operations control plane", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "WebAuthn is Chromium-only.");

  test("redirects an unauthenticated request to sign-in", async ({ page }) => {
    await page.goto("/admin/operations");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test.describe("authenticated", () => {
    test.use({ storageState: ADMIN_STORAGE_STATE });

    test("an admin can view the operations dashboard with real sections rendered", async ({
      page,
    }) => {
      await page.goto("/admin/operations");
      await ensureRealPage(page);
      await expect(page.getByRole("heading", { name: "Operations summary" })).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByRole("heading", { name: "Active operational alerts" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Capacity and monitoring" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Reliability trends" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Manual operational actions" })).toBeVisible();
      // A real, data-derived metric — not a placeholder.
      await expect(page.getByText("Public overall status")).toBeVisible();
    });

    test("drill-down links point at real, existing admin routes", async ({ page }) => {
      await page.goto("/admin/operations");
      await ensureRealPage(page);
      await expect(page.getByRole("link", { name: "Jobs" })).toHaveAttribute("href", "/admin/jobs");
      await expect(page.getByRole("link", { name: "Incidents" })).toHaveAttribute(
        "href",
        "/admin/incidents",
      );
    });
  });
});

test.describe("Public status Atom feed", () => {
  test("returns a valid, unauthenticated Atom feed", async ({ request }) => {
    const response = await request.get("/status/feed.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/atom+xml");
    expect(response.headers()["x-robots-tag"]).toBe("noindex");
    const body = await response.text();
    expect(body).toContain("<feed xmlns=");
  });
});
