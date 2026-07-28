import type { Page } from "@playwright/test";
import { ensureRealPage } from "./navigation";

/** Runs the real passkey sign-up ceremony in the browser (requires a virtual
 * authenticator already attached via `addVirtualAuthenticator`). Ends on
 * the recovery-codes screen, matching a real first-time sign-up. */
export async function registerNewAccount(page: Page, displayName: string): Promise<void> {
  await registerNewAccountCapturingRecoveryCodes(page, displayName);
}

/** Same real sign-up ceremony as `registerNewAccount`, but also returns the
 * one-time recovery codes the server actually issued (read from the real
 * `/api/auth/register/finish` response, the same data the recovery-codes
 * screen renders) — needed by any test that later signs in with one of
 * them, since the codes are shown exactly once and never persisted
 * anywhere the test could otherwise read them back from. */
export async function registerNewAccountCapturingRecoveryCodes(
  page: Page,
  displayName: string,
): Promise<string[]> {
  await page.goto("/sign-in");
  // PasskeyAuth is a `client:load` React island — wait for hydration before
  // interacting, otherwise a click can fire before React attaches its
  // handler (same race documented in tests/e2e/landing-page.spec.ts).
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByLabel("Display name").fill(displayName);
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/auth/register/finish")),
    page.getByRole("button", { name: "Create account with a passkey" }).click(),
  ]);
  const body = (await response.json()) as { data: { recoveryCodes: string[] } };
  await page.getByText("Save your recovery codes now").waitFor();
  await page.getByLabel("I have saved these recovery codes somewhere safe.").check();
  await page.getByRole("button", { name: "Continue to dashboard" }).click();
  await page.waitForURL("**/app");
  await ensureRealPage(page);
  return body.data.recoveryCodes;
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
