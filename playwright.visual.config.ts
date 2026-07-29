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
      // devices["Desktop Chrome"] carries its own viewport (1280x720), so it
      // must be spread first — otherwise it silently overwrites the explicit
      // viewport below and every "mobile"/"tablet" project actually
      // screenshots at desktop width. See docs/status/KNOWN_RISKS.md.
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 740 } },
    },
    {
      name: "mobile-390",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "mobile-480",
      use: { ...devices["Desktop Chrome"], viewport: { width: 480, height: 900 } },
    },
    {
      name: "tablet-768",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
    {
      name: "desktop-1024",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 800 } },
    },
    {
      name: "desktop-1280",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
    {
      name: "desktop-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 960 } },
    },
  ],
});
