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
      {
        // Phase 12: `pnpm test:security` — an explicit, curated allowlist
        // (not a glob by naming convention) so this project stays a
        // deliberate, reviewed set of security-relevant regression tests
        // rather than silently growing/shrinking with unrelated file
        // renames. Overlaps with "unit"/"integration" by design (same test
        // files, different, faster-to-run selection) — see
        // docs/security/SECURITY_TEST_SUITE.md for what's covered and why
        // each file is included.
        test: {
          name: "security",
          environment: "node",
          include: [
            "apps/web/src/lib/security-headers.test.ts",
            "apps/web/src/pages/.well-known/security.txt.test.ts",
            "packages/scanner/src/safe-fetch.test.ts",
            "apps/web/tests/integration/csrf.integration.test.ts",
            "apps/web/tests/integration/audit-abuse-prevention.integration.test.ts",
            "apps/web/tests/integration/target-abuse-monitoring.integration.test.ts",
            "apps/web/tests/integration/admin-security.integration.test.ts",
            "apps/web/tests/integration/atom-feed-hardening.integration.test.ts",
          ],
          exclude: ["**/node_modules/**"],
        },
      },
    ],
  },
});
