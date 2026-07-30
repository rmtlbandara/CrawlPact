import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against the built/preview site. See
// docs/testing/TEST_STRATEGY.md for what belongs in e2e vs. unit/integration.
export default defineConfig({
  testDir: "./apps/web/tests/e2e",
  globalSetup: "./apps/web/tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // A flaky test that only passes on retry is not clean — CI now reports it
  // as a real failure rather than papering over it with a second retry (see
  // docs/architecture/adr/ADR-0008-remove-pixel-visual-regression.md's
  // sibling reasoning about not masking instability with tolerance/retries).
  retries: process.env.CI ? 1 : 0,
  // One worker in CI: this suite includes real D1-mutating auth/admin/domain
  // journeys against a single shared local D1 file (wrangler --local) —
  // increase this only after measured evidence shows no shared-state
  // conflict at higher concurrency.
  workers: process.env.CI ? 1 : undefined,
  // This suite had never actually run to completion in GitHub Actions CI
  // before 2026-07-27 (the `quality` job always failed first, so
  // `e2e-and-a11y`, which `needs: quality`, was always skipped) — the first
  // real run took 17 minutes for what completes in ~1-2 minutes locally,
  // and 9/27 test cases hit the default 30s per-test timeout on real
  // WebAuthn-ceremony/scan/print round-trips that pass locally in ~11s.
  // Retries alone didn't help (all 3 attempts timed out identically), so
  // this is a genuine CI-runner performance gap, not flakiness — doubling
  // the timeout for CI only, not locally. See docs/status/KNOWN_RISKS.md.
  timeout: process.env.CI ? 60_000 : 30_000,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:4321",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: process.env.CI
    ? undefined
    : {
        command: "pnpm --filter @crawlpact/web dev",
        url: "http://localhost:4321",
        reuseExistingServer: true,
        timeout: 60_000,
      },
  projects: [
    // Run once each, before chromium/mobile-safari, and save an
    // authenticated storageState (session cookie) that specs opt into via
    // `test.use({ storageState: ... })` — see helpers/fixture-accounts.ts.
    // Standard Playwright "setup project" pattern; not used anywhere else
    // in this repo before now.
    { name: "setup-customer", testMatch: /customer\.setup\.ts/ },
    { name: "setup-admin", testMatch: /admin\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /.*\.setup\.ts/,
      dependencies: ["setup-customer", "setup-admin"],
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] },
      testIgnore: /.*\.setup\.ts/,
      dependencies: ["setup-customer", "setup-admin"],
    },
  ],
});
