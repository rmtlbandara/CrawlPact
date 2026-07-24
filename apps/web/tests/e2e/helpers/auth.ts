import type { Page } from "@playwright/test";
import { ensureRealPage } from "./navigation";

/** Runs the real passkey sign-up ceremony in the browser (requires a virtual
 * authenticator already attached via `addVirtualAuthenticator`). Ends on
 * the recovery-codes screen, matching a real first-time sign-up. */
export async function registerNewAccount(page: Page, displayName: string): Promise<void> {
  await page.goto("/sign-in");
  // PasskeyAuth is a `client:load` React island — wait for hydration before
  // interacting, otherwise a click can fire before React attaches its
  // handler (same race documented in tests/e2e/landing-page.spec.ts).
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByLabel("Display name").fill(displayName);
  await page.getByRole("button", { name: "Create account with a passkey" }).click();
  await page.getByText("Save your recovery codes now").waitFor();
  await page.getByLabel("I have saved these recovery codes somewhere safe.").check();
  await page.getByRole("button", { name: "Continue to dashboard" }).click();
  await page.waitForURL("**/app");
  await ensureRealPage(page);
}

/** Runs the real usernameless passkey sign-in ceremony (requires a virtual
 * authenticator already attached with the credential from a prior
 * `registerNewAccount` call in the same browser context). */
export async function signInWithPasskey(page: Page): Promise<void> {
  await page.goto("/sign-in");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Sign in with passkey" }).click();
  await page.waitForURL("**/app");
  await ensureRealPage(page);
}
