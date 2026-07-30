import { test as setup } from "@playwright/test";
import { addVirtualAuthenticator } from "../helpers/webauthn";
import { registerNewAccount, signInWithPasskey } from "../helpers/auth";
import { grantSuperAdminToCurrentUser } from "../helpers/admin-db";
import { retryUntilSettled } from "../helpers/hydration";
import {
  ADMIN_STORAGE_STATE,
  ADMIN_FIXTURE_DISPLAY_NAME_PREFIX,
} from "../helpers/fixture-accounts";

/**
 * Runs once (Playwright "setup" project, see playwright.config.ts's
 * `dependencies`) and saves a real, authenticated Super Admin session for
 * every other chromium/mobile-safari test that opts in via
 * `test.use({ storageState: ADMIN_STORAGE_STATE })` — replacing 5
 * independent real WebAuthn ceremonies (4 in admin-flows.spec.ts, 1 in
 * responsive-smoke.spec.ts) with this single one. See
 * docs/status/KNOWN_RISKS.md.
 *
 * The sign-out/sign-in-again step is structurally required, not
 * incidental: login/finish.ts only sets `isAdminSession` when the D1 grant
 * already existed *at sign-in time* — granting the role after the initial
 * registration session doesn't retroactively elevate it.
 */
setup("authenticate as a shared Super Admin fixture", async ({ page }) => {
  await addVirtualAuthenticator(page);
  const displayName = `${ADMIN_FIXTURE_DISPLAY_NAME_PREFIX} ${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  await registerNewAccount(page, displayName);
  await grantSuperAdminToCurrentUser(page);
  // SignOutButton is a `client:load` island — a click before it hydrates
  // is a real click with no effect, so the resulting waitForURL would hang
  // until the test timeout. Retry against the real logout request actually
  // firing instead.
  await retryUntilSettled(async () => {
    await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/auth/logout"), { timeout: 1_000 }),
      page.getByRole("button", { name: "Sign out" }).click(),
    ]);
  });
  await page.waitForURL("**/");
  await signInWithPasskey(page);
  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});
