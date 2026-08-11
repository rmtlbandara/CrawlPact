import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { createD1TestHarness } from "./d1-harness";
import { detectSchedulerAnomalies } from "../../src/lib/admin/scheduler";
import { createDb } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

/**
 * Phase 14: before this phase, no code path ever wrote a "running"
 * `scheduled_job_runs` row before a job's work completed — every INSERT
 * happened post-hoc, after the try/catch resolved — which meant
 * `detectSchedulerAnomalies`'s "stuck"/"overlapping" detection
 * (lib/admin/scheduler.ts) could never actually fire against real data.
 * `worker.ts`'s `startJobRun`/`finishJobRun` now insert a real "running"
 * row first and update it in place. This test proves the underlying
 * mechanism against real D1 (the `INSERT` then `UPDATE ... WHERE id = ?`
 * using `result.meta.last_row_id`, a pattern new to this codebase) and that
 * stuck/overlapping detection is now actually reachable.
 */
describe("scheduled_job_runs running -> completed lifecycle (real D1)", () => {
  let dispose: () => Promise<void>;
  let rawDb: D1Database;
  let db: Database;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    rawDb = harness.db as unknown as D1Database;
    db = createDb(harness.db);
  });

  afterAll(async () => {
    await dispose();
  });

  it("INSERT ... status='running' followed by UPDATE ... WHERE id = <last_row_id> transitions the same row to completed", async () => {
    const startedAt = new Date().toISOString();
    const insertResult = await rawDb
      .prepare(
        "INSERT INTO scheduled_job_runs (job_name, cron_expression, status, started_at) VALUES (?, ?, 'running', ?)",
      )
      .bind("lifecycle_test_job", "0 3 * * *", startedAt)
      .run();
    const runId = insertResult.meta.last_row_id;
    expect(typeof runId).toBe("number");

    const completedAt = new Date().toISOString();
    await rawDb
      .prepare("UPDATE scheduled_job_runs SET status = 'completed', completed_at = ? WHERE id = ?")
      .bind(completedAt, runId)
      .run();

    const row = await rawDb
      .prepare("SELECT * FROM scheduled_job_runs WHERE id = ?")
      .bind(runId)
      .first<{ status: string; started_at: string; completed_at: string }>();
    expect(row?.status).toBe("completed");
    expect(row?.started_at).toBe(startedAt);
    expect(row?.completed_at).toBe(completedAt);

    // Exactly one row exists for this job — the UPDATE modified the
    // original row in place rather than the old post-hoc pattern of a
    // second INSERT.
    const allRows = await rawDb
      .prepare("SELECT count(*) as n FROM scheduled_job_runs WHERE job_name = 'lifecycle_test_job'")
      .first<{ n: number }>();
    expect(allRows?.n).toBe(1);
  });

  it("a running row older than 15 minutes is now detected as stuck", async () => {
    const staleStartedAt = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    await rawDb
      .prepare(
        "INSERT INTO scheduled_job_runs (job_name, cron_expression, status, started_at) VALUES (?, ?, 'running', ?)",
      )
      .bind("stuck_test_job", "0 3 * * *", staleStartedAt)
      .run();

    const anomalies = await detectSchedulerAnomalies(db);
    expect(anomalies.some((a) => a.type === "stuck" && a.jobName === "stuck_test_job")).toBe(true);
  });

  it("two concurrent running rows for the same job are detected as overlapping", async () => {
    const startedAt = new Date().toISOString();
    for (let i = 0; i < 2; i++) {
      await rawDb
        .prepare(
          "INSERT INTO scheduled_job_runs (job_name, cron_expression, status, started_at) VALUES (?, ?, 'running', ?)",
        )
        .bind("overlap_test_job", "0 3 * * *", startedAt)
        .run();
    }

    const anomalies = await detectSchedulerAnomalies(db);
    expect(
      anomalies.some((a) => a.type === "overlapping" && a.jobName === "overlap_test_job"),
    ).toBe(true);
  });
});
