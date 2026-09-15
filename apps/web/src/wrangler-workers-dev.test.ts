import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse as parseJsonc } from "jsonc-parser";
import { describe, expect, it } from "vitest";

/**
 * Phase 4D.1 (Master Finalization Directive, 2026-09-15): Production's
 * rollback window has closed (Stage A/B/C all deployed, live-validated, and
 * stable — see docs/baseline/2026-09-14-app-subdomain-final-completion/).
 * Production now has `workers_dev: false` — its `*.workers.dev` subdomain is
 * redundant public surface once a working Custom Domain exists, not a
 * needed fallback (Worker version rollback operates on the Custom Domain
 * routes directly). Preview explicitly keeps `workers_dev: true`, declared
 * in full rather than relying on named-environment inheritance — the same
 * defensive pattern this repo already uses for `observability`/`assets`
 * (see `wrangler-observability.test.ts`'s own comment for the empirical
 * build-output-diff precedent this test doesn't repeat but relies on the
 * same reasoning for).
 */
describe("wrangler.jsonc workers.dev configuration", () => {
  const configPath = fileURLToPath(new URL("../wrangler.jsonc", import.meta.url));
  const config = parseJsonc(readFileSync(configPath, "utf-8")) as {
    workers_dev?: boolean;
    env?: {
      preview?: { workers_dev?: boolean };
    };
  };

  it("disables workers.dev at the top level (Production) — redundant once a Custom Domain exists", () => {
    expect(config.workers_dev).toBe(false);
  });

  it("keeps workers.dev enabled for Preview, declared explicitly (not relying on inheritance)", () => {
    expect(config.env?.preview?.workers_dev).toBe(true);
  });
});
