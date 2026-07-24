import { defineConfig } from "vitest/config";

// Two logical projects, selectable via `vitest run --project <name>`:
// - "unit": fast, no I/O, no network — packages/* and apps/web pure logic.
// - "integration": exercises Cloudflare bindings (D1 via Miniflare), no
//   production credentials required (see docs/testing/TEST_STRATEGY.md).
export default defineConfig({
  test: {
    reporters: process.env.CI ? ["dot", "github-actions"] : ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["**/*.config.*", "**/dist/**", "**/*.d.ts", "**/tests/**"],
    },
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["packages/*/src/**/*.test.ts", "apps/web/src/**/*.test.ts"],
          exclude: ["**/*.integration.test.ts", "**/node_modules/**"],
        },
      },
      {
        test: {
          name: "integration",
          environment: "node",
          include: [
            "packages/*/src/**/*.integration.test.ts",
            "apps/web/tests/integration/**/*.test.ts",
          ],
          exclude: ["**/node_modules/**"],
        },
      },
    ],
  },
});
