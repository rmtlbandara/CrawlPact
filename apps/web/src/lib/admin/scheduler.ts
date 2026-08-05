import { desc, eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { getBoolConfig } from "../runtime-config";

const STUCK_JOB_THRESHOLD_MS = 15 * 60 * 1000;
const LONG_EXECUTION_THRESHOLD_MS = 5 * 60 * 1000;
const HIGH_FAILURE_RATE_THRESHOLD = 0.3;
/** Both jobs are declared on the same cron in wrangler.jsonc — "missed" means
 * no run at all in more than 2x that interval. */
const EXPECTED_INTERVAL_MS = 60 * 60 * 1000;

export async function listScheduledJobRuns(db: Database, limit = 100) {
  return db
    .select()
    .from(schema.scheduledJobRuns)
    .orderBy(desc(schema.scheduledJobRuns.startedAt))
    .limit(limit);
}

export type SchedulerAnomaly = {
  type: "missed" | "overlapping" | "stuck" | "long_execution" | "excessive_failure_rate";
  jobName: string;
  detail: string;
};

/** SRS §28.10: detect missed executions, overlapping jobs, stuck jobs, long
 * executions, excessive failure rates — computed from real
 * `scheduled_job_runs` rows, never simulated. */
export async function detectSchedulerAnomalies(db: Database): Promise<SchedulerAnomaly[]> {
  const runs = await listScheduledJobRuns(db, 200);
  const anomalies: SchedulerAnomaly[] = [];
  const now = Date.now();

  const byJob = new Map<string, typeof runs>();
  for (const run of runs) {
    byJob.set(run.jobName, [...(byJob.get(run.jobName) ?? []), run]);
  }

  for (const [jobName, jobRuns] of byJob) {
    const mostRecent = jobRuns[0];
    if (mostRecent) {
      const ageMs = now - new Date(mostRecent.startedAt).getTime();
      if (ageMs > EXPECTED_INTERVAL_MS * 2) {
        anomalies.push({
          type: "missed",
          jobName,
          detail: `No run recorded in the last ${Math.round(ageMs / 60000)} minutes.`,
        });
      }
    }

    const running = jobRuns.filter((r) => r.status === "running");
    if (running.length > 1) {
      anomalies.push({
        type: "overlapping",
        jobName,
        detail: `${running.length} concurrent "running" rows — a job may have started before the previous one finished.`,
      });
    }
    for (const run of running) {
      const ageMs = now - new Date(run.startedAt).getTime();
      if (ageMs > STUCK_JOB_THRESHOLD_MS) {
        anomalies.push({
          type: "stuck",
          jobName,
          detail: `Run started ${Math.round(ageMs / 60000)} minutes ago and has not completed.`,
        });
      }
    }

    for (const run of jobRuns) {
      if (!run.completedAt) continue;
      const durationMs = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
      if (durationMs > LONG_EXECUTION_THRESHOLD_MS) {
        anomalies.push({
          type: "long_execution",
          jobName,
          detail: `A run on ${run.startedAt} took ${Math.round(durationMs / 1000)}s.`,
        });
      }
    }

    const recentRuns = jobRuns.slice(0, 20);
    // Phase 11 (Stage 11D): "completed_with_errors" (a retention run that
    // isolated a per-category failure rather than aborting entirely) still
    // counts toward the failure rate — it means a real error occurred, just
    // one that didn't take the whole job down with it.
    const failedCount = recentRuns.filter(
      (r) => r.status === "failed" || r.status === "completed_with_errors",
    ).length;
    if (recentRuns.length >= 5 && failedCount / recentRuns.length > HIGH_FAILURE_RATE_THRESHOLD) {
      anomalies.push({
        type: "excessive_failure_rate",
        jobName,
        detail: `${failedCount}/${recentRuns.length} of the most recent runs failed.`,
      });
    }
  }

  return anomalies;
}

export async function isSchedulerPaused(db: Database): Promise<boolean> {
  return getBoolConfig(db, "scheduler_paused", false);
}

export async function setSchedulerPaused(db: Database, paused: boolean): Promise<void> {
  await db
    .update(schema.runtimeConfiguration)
    .set({ value: paused ? "true" : "false", updatedAt: new Date().toISOString() })
    .where(eq(schema.runtimeConfiguration.key, "scheduler_paused"));
}
