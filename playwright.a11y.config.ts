import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

// Accessibility smoke tests: axe-core scans of key public routes.
// See apps/web/tests/a11y and docs/testing/TEST_STRATEGY.md.
export default defineConfig({
  ...baseConfig,
  testDir: "./apps/web/tests/a11y",
});
