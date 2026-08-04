import { expect, test } from "@playwright/test";
import { addVirtualAuthenticator } from "./helpers/webauthn";
import { retryUntilSettled } from "./helpers/hydration";
import { ensureRealPage } from "./helpers/navigation";

/**
 * Phase 6 checkout continuity: a visitor's plan/interval choice on the public /pricing page
 * survives the sign-up round trip and lands them on /app/billing with that choice preselected —
 * see docs/billing/CHECKOUT_CONTINUITY_ARCHITECTURE.md. This exercises the real browser
 * navigation chain (no Paddle interaction — the actual checkout-opening click is never made
 * here, since no real sandbox Paddle catalog exists yet; see
 * docs/billing/PADDLE_CATALOG_RECONCILIATION_RUNBOOK.md).
 */
test.describe("Checkout continuity (pricing -> sign-up -> billing)", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "WebAuthn virtual authenticator is Chromium-only.",
  );

  test("an anonymous visitor's plan/interval choice survives sign-up and preselects on the billing page", async ({
    page,
  }) => {
    await addVirtualAuthenticator(page);

    await page.goto("/pricing");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Yearly is the default toggle state — Pro's card CTA should read "Choose Pro" and link to
    // /sign-in?plan=pro&interval=year for an anonymous visitor.
    const proCard = page.locator("#pro");
    await retryUntilSettled(async () => {
      await proCard.getByRole("link", { name: "Choose Pro" }).click();
      await page.waitForURL("**/sign-in?plan=pro&interval=year", { timeout: 1_000 });
    });

    await expect(
      page.getByRole("heading", { name: "Create an account to subscribe to Pro" }),
    ).toBeVisible();

    // sign-in.astro's initialMode is already "signup" when a plan is present — the signup form
    // renders directly, no toggle click needed.
    const displayName = `E2E Checkout Continuity ${Date.now()}`;
    await page.getByLabel("Display name").fill(displayName);
    await page.getByRole("button", { name: "Create account with a passkey" }).click();
    await page.getByText("Save your recovery codes now").waitFor();
    await page.getByLabel("I have saved these recovery codes somewhere safe.").check();

    await Promise.all([
      page.waitForURL("**/app/billing?plan=pro&interval=year"),
      page.getByRole("button", { name: "Continue to dashboard" }).click(),
    ]);
    await ensureRealPage(page);

    // Free account, no active subscription yet: BillingPlansSection renders a CheckoutButton for
    // each plan (not a PlanChangeButton), and the yearly toggle is preselected from the query
    // param — never trusted for price resolution itself, only this UI default.
    await expect(page.getByRole("heading", { name: "Plans" })).toBeVisible();
    const yearlyToggle = page.getByRole("button", { name: "Yearly", exact: true });
    await expect(yearlyToggle).toHaveAttribute("aria-pressed", "true");
  });
});
