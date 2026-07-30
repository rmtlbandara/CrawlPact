import { test as setup } from "@playwright/test";
import { addVirtualAuthenticator } from "../helpers/webauthn";
import { registerNewAccount, signInWithPasskey } from "../helpers/auth";
import { findUserIdByDisplayName, grantSuperAdmin } from "../helpers/admin-db";
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
  const userId = await findUserIdByDisplayName(displayName);
  await grantSuperAdmin(userId);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/");
  await signInWithPasskey(page);
  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});
