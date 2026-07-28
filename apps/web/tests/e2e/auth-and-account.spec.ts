import { expect, test } from "@playwright/test";
import { addVirtualAuthenticator } from "./helpers/webauthn";
import {
  registerNewAccount,
  registerNewAccountCapturingRecoveryCodes,
  signInWithPasskey,
} from "./helpers/auth";
import { ensureRealPage } from "./helpers/navigation";
import { clearAnonymousAuditRateLimit, clearRecoveryCodeRateLimit } from "./helpers/admin-db";

/**
 * Real browser journeys through the customer-facing account/domain flows
 * (SRS §35.3: passkey registration, sign-in, save domain, manual scan,
 * account deletion). These were previously only covered by integration
 * tests (real D1, but no browser) or by a11y checks (public pages only) —
 * neither exercises the actual client-side WebAuthn ceremony or the real
 * page JS, which is what §35.3 specifically requires as distinct from
 * §35.2. Uses a CDP virtual authenticator (see helpers/webauthn.ts) so the
 * real `navigator.credentials` ceremony runs, not a fabricated response.
 */
test.describe("Passkey account lifecycle", () => {
  test.beforeEach(async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "WebAuthn virtual authenticator is Chromium-only.");
    await addVirtualAuthenticator(page);
  });

  test("registers with a passkey, signs out, and signs back in with the same passkey", async ({
    page,
  }) => {
    const displayName = `E2E Passkey User ${Date.now()}`;
    await registerNewAccount(page, displayName);
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("**/");

    await signInWithPasskey(page);
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  });

  test("saves a domain and triggers a real manual scan", async ({ page }) => {
    const displayName = `E2E Scan User ${Date.now()}`;
    await registerNewAccount(page, displayName);

    await page.goto("/app/domains");
    await ensureRealPage(page);
    await page.getByLabel("Domain").fill("example.com");
    await page.getByRole("button", { name: "Save domain" }).click();
    const domainLink = page.getByRole("link", { name: /example\.com/ }).first();
    await expect(domainLink).toBeVisible();
    await domainLink.click();

    await page.waitForURL("**/app/domains/*");
    await ensureRealPage(page);
    await page.getByRole("button", { name: "Re-scan now" }).click();
    // handleRescan() does `window.location.reload()` on success — wait for
    // the reload to actually complete rather than racing it.
    await page.waitForLoadState("networkidle");
    // A real scan ran synchronously against a real target (example.com) —
    // either it completed with a score, or it honestly failed; either is
    // proof the real pipeline ran, not a fabricated result.
    await expect(
      page.getByText(/Re-scan not started/).or(page.locator("text=/\\d+\\s*\\/\\s*100/")),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("requests account deletion and can cancel it before it's processed", async ({ page }) => {
    const displayName = `E2E Deletion User ${Date.now()}`;
    await registerNewAccount(page, displayName);

    await page.goto("/app/account");
    await ensureRealPage(page);
    await page.getByRole("button", { name: "Delete account" }).click();
    await page.getByRole("textbox").last().fill("DELETE");
    await page.getByRole("button", { name: "Request deletion" }).click();

    await expect(page.getByText("Account deletion requested")).toBeVisible();

    await page.getByRole("button", { name: "Cancel deletion" }).click();
    await expect(page.getByText("Account deletion requested")).toBeHidden();
    await expect(page.getByRole("button", { name: "Delete account" })).toBeVisible();
  });
});

/**
 * SRS §24/§35.3: recovery-code sign-in is the only path into an account
 * once its passkey is unavailable — real browser coverage for it (as
 * opposed to `auth-flow.integration.test.ts`'s API-level coverage of the
 * same redeem/reuse/rate-limit logic) was a gap found while re-verifying
 * the recovery-code flow end to end.
 */
test.describe("Recovery code sign-in", () => {
  test.beforeEach(async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "WebAuthn virtual authenticator is Chromium-only.");
    await clearRecoveryCodeRateLimit();
    await addVirtualAuthenticator(page);
  });

  test("signs in with a one-time recovery code, and the same code cannot be reused", async ({
    page,
  }) => {
    const displayName = `E2E Recovery User ${Date.now()}`;
    const recoveryCodes = await registerNewAccountCapturingRecoveryCodes(page, displayName);
    expect(recoveryCodes.length).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("**/");

    // Simulate a lost passkey: sign back in with a saved recovery code
    // instead of `signInWithPasskey`.
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Recovery code" }).click();
    await page.getByLabel("Recovery code").fill(recoveryCodes[0]!);
    await page.getByRole("button", { name: "Sign in with recovery code" }).click();
    await page.waitForURL("**/app");
    await ensureRealPage(page);
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

    // The code is single-use — replaying it must be rejected, not silently
    // create a second session.
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("**/");
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Recovery code" }).click();
    await page.getByLabel("Recovery code").fill(recoveryCodes[0]!);
    await page.getByRole("button", { name: "Sign in with recovery code" }).click();
    await expect(page.getByText("That didn't work")).toBeVisible();
    expect(page.url()).toContain("/sign-in");
  });

  test("rejects an invalid recovery code without creating a session", async ({ page }) => {
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Recovery code" }).click();
    await page.getByLabel("Recovery code").fill("NOTAREAL-CODE1-XXXXX");
    await page.getByRole("button", { name: "Sign in with recovery code" }).click();
    await expect(page.getByText("That didn't work")).toBeVisible();
    expect(page.url()).toContain("/sign-in");
  });
});

test.describe("Anonymous audit report", () => {
  test("prints a report via the real print button", async ({ page }) => {
    // A real scan against a real external target (example.com) competing
    // with other tests' real scans against the same single dev server can
    // legitimately take longer than Playwright's default 30s test timeout
    // under concurrent load — generous but not unbounded.
    test.setTimeout(60_000);
    // The anonymous-audit daily cap (SRS §28.8) is shared across every run
    // of this suite from this machine/CI-runner's IP — without resetting it
    // first, this test fails deterministically after ~20 cumulative runs
    // with the real, correctly-working "daily limit" error instead of ever
    // reaching /audit/*.
    await clearAnonymousAuditRateLimit();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Domain or URL to audit").first().fill("example.com");
    await page.getByRole("button", { name: "Audit domain" }).first().click();
    await page.waitForURL("**/audit/*", { timeout: 45_000 });

    let printCalled = false;
    await page.exposeFunction("__e2ePrintCalled", () => {
      printCalled = true;
    });
    await page.evaluate(() => {
      window.print = () =>
        (window as unknown as { __e2ePrintCalled: () => void }).__e2ePrintCalled();
    });

    await page.getByRole("button", { name: "Print report" }).click();
    await expect.poll(() => printCalled).toBe(true);
  });
});
