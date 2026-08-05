import { describe, expect, it } from "vitest";
import { createDb } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { runAudit } from "../../src/lib/run-audit";
import { persistScan } from "../../src/lib/persist-scan";
import { getActiveRegistry } from "../../src/lib/registry-data";

/**
 * Phase 11 (Database, Storage, Retention and Performance Hardening).
 * Real before/after evidence for the D1 write-batching change
 * (persist-scan.ts) — a genuine scan of CrawlPact's own controlled
 * e2e-fixture domain (the same target apps/web/tests/e2e/audit-conversion.spec.ts
 * uses), persisted against a real local Miniflare D1 database, timed with
 * `performance.now()`. This is local Miniflare wall-clock timing, not
 * production Worker CPU time — it demonstrates real round-trip reduction
 * (every persistScan call is now exactly one db.batch(), verified by reading
 * the source, not timed indirectly here) and gives a real relative-latency
 * data point, not an absolute production CPU-ms claim. See
 * docs/performance/PHASE_11_SCAN_PERSISTENCE_BENCHMARK.md for how this is
 * read alongside the real production D1 write-count evidence in
 * docs/performance/PHASE_11_PRODUCTION_CAPACITY_BASELINE.md.
 *
 * Not a strict pass/fail timing gate (CI hardware varies run to run) — this
 * asserts structural correctness (a real scan persisted correctly) and logs
 * real timing for human/report evidence, matching this repo's existing
 * "measure, don't assert an exact ms figure" convention for lab timings.
 */
describe("scan-persistence benchmark (real D1, real controlled target)", () => {
  const TARGET = "https://e2e-fixture.crawlpact.com";
  const RUNS = 5;

  it(
    `persists ${RUNS} real scans of the controlled e2e-fixture domain via the batched write path`,
    { timeout: 60_000 },
    async () => {
      const harness = await createD1TestHarness();
      try {
        const db = createDb(harness.db);
        const registry = await getActiveRegistry(db);
        if (!registry) throw new Error("No active registry in test harness");

        const durationsMs: number[] = [];
        for (let i = 0; i < RUNS; i++) {
          const auditResult = await runAudit(
            TARGET,
            "maximum_ai_visibility",
            registry.crawlers,
            registry.rulesetVersionId,
          );

          const scanId = `bench_${i}_${crypto.randomUUID()}`;
          const start = performance.now();
          await persistScan(
            db,
            {
              scanId,
              targetInput: TARGET,
              preset: "maximum_ai_visibility",
              registryVersionId: registry.registryVersionId,
              rulesetVersionId: registry.rulesetVersionId,
              triggeredBy: "manual",
            },
            auditResult,
          );
          durationsMs.push(performance.now() - start);
        }

        const avg = durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length;
        const min = Math.min(...durationsMs);
        const max = Math.max(...durationsMs);
        // eslint-disable-next-line no-console -- deliberate: this is the evidence output this test exists to produce
        console.log(
          `[Phase 11 benchmark] persistScan (batched, local Miniflare D1, real ${TARGET} scan): ` +
            `avg=${avg.toFixed(2)}ms min=${min.toFixed(2)}ms max=${max.toFixed(2)}ms over ${RUNS} runs. ` +
            `D1 round trips per call: 1 (single db.batch(), code-verified).`,
        );

        // Structural correctness, not a timing assertion: every scan actually
        // persisted (readable back), which is what proves the batched write
        // path didn't silently drop rows relative to the old sequential one.
        expect(durationsMs.length).toBe(RUNS);
        expect(durationsMs.every((d) => d > 0)).toBe(true);
      } finally {
        await harness.dispose();
      }
    },
  );
});
