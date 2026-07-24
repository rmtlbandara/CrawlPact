import { handle } from "@astrojs/cloudflare/handler";
import { createDb } from "@crawlpact/database";
import { runMonitoringSweep } from "./lib/monitoring";
import { runDataRetentionPurge } from "./lib/data-retention";

/**
 * Custom Worker entry point (ADR-0001). Delegates ordinary requests to
 * Astro's SSR handler and additionally exports `scheduled`, so the same
 * deployable Worker serves the public site, the same-origin API, and the
 * monitoring/retention cron trigger declared in wrangler.jsonc.
 *
 * Monitoring (SRS §25, Step 15) and data retention (SRS §34, Step 19) are
 * separate jobs recorded as separate `scheduled_job_runs` rows, so a
 * failure in one is never hidden by the other's success. Retention runs
 * unconditionally — it's a privacy/compliance job, not a scanning one, so
 * it isn't gated behind `AUDIT_ENGINE_ENABLED` the way monitoring is.
 */
export default {
  fetch: handle,

  async scheduled(controller, env, ctx) {
    const db = createDb(env.DB);

    ctx.waitUntil(runRetentionJob(env, controller.cron, db));

    if (env.AUDIT_ENGINE_ENABLED === "true") {
      const schedulerPaused = await isSchedulerPaused(env.DB);
      // SRS §28.17: maintenance mode independently pauses scheduled scans,
      // on top of (not instead of) Step 7's incident-specific scheduler
      // pause — either flag alone is enough to skip this sweep.
      const maintenanceMode = await isMaintenanceMode(env.DB);
      if (schedulerPaused || maintenanceMode) {
        await env.DB.prepare(
          "INSERT INTO scheduled_job_runs (job_name, cron_expression, status, error_summary, started_at, completed_at) VALUES (?, ?, 'completed', ?, ?, ?)",
        )
          .bind(
            "monitoring_sweep",
            controller.cron,
            maintenanceMode
              ? "Skipped: maintenance mode is active (SRS §28.17)."
              : "Skipped: scheduled monitoring is globally paused (SRS §28.10).",
            new Date().toISOString(),
            new Date().toISOString(),
          )
          .run();
      } else {
        ctx.waitUntil(runMonitoringJob(env, controller.cron, db));
      }
    }
  },
} satisfies ExportedHandler<Env>;

async function runMonitoringJob(
  env: Env,
  cronExpression: string,
  db: ReturnType<typeof createDb>,
): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    const result = await runMonitoringSweep(db);
    await env.DB.prepare(
      "INSERT INTO scheduled_job_runs (job_name, cron_expression, status, domains_selected, scans_created, scans_completed, scans_failed, started_at, completed_at) VALUES (?, ?, 'completed', ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        "monitoring_sweep",
        cronExpression,
        result.domainsSelected,
        result.domainsSelected,
        result.scansCompleted,
        result.scansFailed,
        startedAt,
        new Date().toISOString(),
      )
      .run();
  } catch (error) {
    await recordFailedJob(env, "monitoring_sweep", cronExpression, startedAt, error);
  }
}

async function runRetentionJob(
  env: Env,
  cronExpression: string,
  db: ReturnType<typeof createDb>,
): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    const result = await runDataRetentionPurge(db);
    await env.DB.prepare(
      "INSERT INTO scheduled_job_runs (job_name, cron_expression, status, error_summary, started_at, completed_at) VALUES (?, ?, 'completed', ?, ?, ?)",
    )
      .bind(
        "data_retention_purge",
        cronExpression,
        `anonymous_scans=${result.anonymousScansDeleted} domain_scans=${result.domainScansDeleted} accounts=${result.accountsPurged} entitlements_expired=${result.entitlementsExpired}`,
        startedAt,
        new Date().toISOString(),
      )
      .run();
  } catch (error) {
    await recordFailedJob(env, "data_retention_purge", cronExpression, startedAt, error);
  }
}

async function recordFailedJob(
  env: Env,
  jobName: string,
  cronExpression: string,
  startedAt: string,
  error: unknown,
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO scheduled_job_runs (job_name, cron_expression, status, error_summary, started_at, completed_at) VALUES (?, ?, 'failed', ?, ?, ?)",
  )
    .bind(
      jobName,
      cronExpression,
      error instanceof Error ? error.message : String(error),
      startedAt,
      new Date().toISOString(),
    )
    .run();
}

async function isSchedulerPaused(db: D1Database): Promise<boolean> {
  const row = await db
    .prepare("SELECT value FROM runtime_configuration WHERE key = 'scheduler_paused'")
    .first();
  return (row as { value: string } | null)?.value === "true";
}

async function isMaintenanceMode(db: D1Database): Promise<boolean> {
  const row = await db
    .prepare("SELECT value FROM runtime_configuration WHERE key = 'maintenance_mode'")
    .first();
  return (row as { value: string } | null)?.value === "true";
}

type Env = {
  DB: D1Database;
  AUDIT_ENGINE_ENABLED: string;
};
