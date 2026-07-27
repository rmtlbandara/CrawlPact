import { expect, test } from "@playwright/test";

/**
 * `/pay` hosts Paddle's public default-payment-link/`_ptxn` recovery flow
 * (see docs/deployment/PADDLE_LIVE_CONFIGURATION.md). Only the no-`_ptxn`
 * path is exercised here — the real Paddle.js checkout-open path would
 * require mocking Paddle's own CDN/API, out of scope for this suite (see
 * the auth/billing e2e gap already disclosed in docs/status/KNOWN_RISKS.md).
 */
test.describe("/pay — public Paddle payment-link host", () => {
  test("is reachable without authentication and needs no server-side redirect", async ({
    page,
  }) => {
    const response = await page.goto("/pay");
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading", { name: "Complete your payment" })).toBeVisible();
  });

  test("shows a safe, actionable error state when no _ptxn is present", async ({ page }) => {
    await page.goto("/pay");
    await expect(page.getByRole("alert")).toContainText("No payment reference found");
    await expect(page.getByRole("link", { name: "Return to CrawlPact" })).toBeVisible();
  });
});
