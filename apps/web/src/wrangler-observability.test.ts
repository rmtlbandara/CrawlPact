import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse as parseJsonc } from "jsonc-parser";
import { describe, expect, it } from "vitest";

/**
 * Pre-Phase-4 observability step 1 (2026-09-11): `observability` is
 * `@inheritable` in Wrangler's config schema, but this repo's `env.preview`
 * block declares it in full rather than relying on inheritance (same
 * defensive pattern already used for `assets`, see wrangler.jsonc's own
 * comment) — empirically confirmed by building both targets and diffing the
 * generated `apps/web/dist/server/wrangler.json`: Production carries no
 * `observability` key at all, Preview carries exactly this value.
 *
 * This test guards the *source* config against silent drift between passes —
 * it does not replace that empirical build-output check, which doesn't run
 * in the fast unit suite.
 */
describe("wrangler.jsonc observability configuration", () => {
  const configPath = fileURLToPath(new URL("../wrangler.jsonc", import.meta.url));
  const config = parseJsonc(readFileSync(configPath, "utf-8")) as {
    observability?: unknown;
    env?: {
      preview?: {
        observability?: { enabled?: boolean; head_sampling_rate?: number; traces?: unknown };
      };
    };
  };

  it("does not enable observability at the top level (Production stays untouched)", () => {
    expect(config.observability).toBeUndefined();
  });

  it("enables observability for Preview with 100% head sampling", () => {
    expect(config.env?.preview?.observability?.enabled).toBe(true);
    expect(config.env?.preview?.observability?.head_sampling_rate).toBe(1);
  });

  it("does not enable Workers Traces for Preview in this step", () => {
    expect(config.env?.preview?.observability?.traces).toBeUndefined();
  });
});
