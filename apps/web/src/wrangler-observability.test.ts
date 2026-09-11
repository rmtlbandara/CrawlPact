import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse as parseJsonc } from "jsonc-parser";
import { describe, expect, it } from "vitest";

/**
 * Pre-Phase-4 observability steps 1 and 2 (2026-09-11): `observability` is
 * `@inheritable` in Wrangler's config schema, but this repo's `env.preview`
 * block declares it in full rather than relying on inheritance (same
 * defensive pattern already used for `assets`, see wrangler.jsonc's own
 * comment) — empirically confirmed by building both targets and diffing the
 * generated `apps/web/dist/server/wrangler.json`: each target carries
 * exactly its own declared value below, independent of the other.
 *
 * Step 2 adds an identical top-level (Production) config, deployed only
 * after a Preview-only experiment with synthetic tokens proved Cloudflare
 * Workers Logs automatically redacts high-entropy path/query values by
 * platform default — see
 * docs/baseline/2026-09-11-app-subdomain-final-pre-phase4/OBSERVABILITY_READINESS.md.
 *
 * This test guards the *source* config against silent drift between passes —
 * it does not replace the empirical build-output check, which doesn't run
 * in the fast unit suite.
 */
describe("wrangler.jsonc observability configuration", () => {
  const configPath = fileURLToPath(new URL("../wrangler.jsonc", import.meta.url));
  const config = parseJsonc(readFileSync(configPath, "utf-8")) as {
    observability?: { enabled?: boolean; head_sampling_rate?: number; traces?: unknown };
    env?: {
      preview?: {
        observability?: { enabled?: boolean; head_sampling_rate?: number; traces?: unknown };
      };
    };
  };

  it("enables observability at the top level (Production) with 100% head sampling", () => {
    expect(config.observability?.enabled).toBe(true);
    expect(config.observability?.head_sampling_rate).toBe(1);
  });

  it("does not enable Workers Traces for Production in this step", () => {
    expect(config.observability?.traces).toBeUndefined();
  });

  it("enables observability for Preview with 100% head sampling", () => {
    expect(config.env?.preview?.observability?.enabled).toBe(true);
    expect(config.env?.preview?.observability?.head_sampling_rate).toBe(1);
  });

  it("does not enable Workers Traces for Preview in this step", () => {
    expect(config.env?.preview?.observability?.traces).toBeUndefined();
  });
});
