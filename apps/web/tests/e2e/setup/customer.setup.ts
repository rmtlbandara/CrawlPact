import { test as setup } from "@playwright/test";
import { addVirtualAuthenticator } from "../helpers/webauthn";
import { registerNewAccount } from "../helpers/auth";
import { CUSTOMER_STORAGE_STATE } from "../helpers/fixture-accounts";

/**
 * Runs once (Playwright "setup" project, see playwright.config.ts's
 * `dependencies`) and saves a real, authenticated session for every other
 * chromium/mobile-safari test that opts in via
 * `test.use({ storageState: CUSTOMER_STORAGE_STATE })` — replacing what
 * would otherwise be an independent real WebAuthn ceremony per test. See
 * docs/status/KNOWN_RISKS.md for which tests do (and deliberately don't)
 * migrate to this shared fixture.
 *
 * This account must stay pristine (no domains ever saved to it) — any test
 * that mutates account state (saves a domain, requests deletion) keeps its
 * own dedicated fresh registration instead of using this fixture, since
 * other tests rely on this one asserting the genuinely-empty state.
 */
setup("authenticate as a shared pristine customer fixture", async ({ page }) => {
  await addVirtualAuthenticator(page);
  const displayName = `Fixture Customer ${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  await registerNewAccount(page, displayName);
  await page.context().storageState({ path: CUSTOMER_STORAGE_STATE });
});
