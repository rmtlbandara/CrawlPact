import { defineConfig, devices } from "@playwright/test";

// Visual regression snapshots across the breakpoints required by SRS §10.56.
// Snapshots are stored under apps/web/tests/visual/__screenshots__ and are
// intentionally excluded from ordinary `test:e2e` runs so they don't flake CI
// on unrelated PRs; run explicitly via `pnpm test:visual`.
export default defineConfig({
  testDir: "./apps/web/tests/visual",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:4321",
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
    {
      name: "mobile-360",
      use: { viewport: { width: 360, height: 740 }, ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-390",
      use: { viewport: { width: 390, height: 844 }, ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-480",
      use: { viewport: { width: 480, height: 900 }, ...devices["Desktop Chrome"] },
    },
    {
      name: "tablet-768",
      use: { viewport: { width: 768, height: 1024 }, ...devices["Desktop Chrome"] },
    },
    {
      name: "desktop-1024",
      use: { viewport: { width: 1024, height: 800 }, ...devices["Desktop Chrome"] },
    },
    {
      name: "desktop-1280",
      use: { viewport: { width: 1280, height: 900 }, ...devices["Desktop Chrome"] },
    },
    {
      name: "desktop-1440",
      use: { viewport: { width: 1440, height: 960 }, ...devices["Desktop Chrome"] },
    },
  ],
});
