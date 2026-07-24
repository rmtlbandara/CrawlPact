import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against the built/preview site. See
// docs/testing/TEST_STRATEGY.md for what belongs in e2e vs. unit/integration.
export default defineConfig({
  testDir: "./apps/web/tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
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
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 13"] } },
  ],
});
