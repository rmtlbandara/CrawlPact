import { handle } from "@astrojs/cloudflare/handler";
import { createDb } from "@crawlpact/database";
import { runMonitoringSweep } from "./lib/monitoring";
import { runDataRetentionPurge } from "./lib/data-retention";
import { applyDueScheduledDowngrades } from "./lib/billing/scheduled-downgrades";
import { reconcileMissingPolicyChangeNotifications } from "./lib/notification-reconciliation";

/**
 * Custom Worker entry point (ADR-0001). Delegates ordinary requests to
 * Astro's SSR handler and additionally exports `scheduled`, so the same
 * deployable Worker serves the public site, the same-origin API, and the
 * monitoring/retention/scheduled-plan-change cron trigger declared in
 * wrangler.jsonc.
 *
 * Monitoring (SRS §25, Step 15), data retention (SRS §34, Step 19), and
 * scheduled plan changes (Phase 6) are separate jobs recorded as separate
 * `scheduled_job_runs` rows, so a failure in one is never hidden by
 * another's success. Retention runs unconditionally — it's a
 * privacy/compliance job, not a scanning one, so it isn't gated behind
 * `AUDIT_ENGINE_ENABLED` the way monitoring is. Scheduled plan changes are
 * gated behind `BILLING_ENABLED` for the same reason monitoring is gated
 * behind `AUDIT_ENGINE_ENABLED` — no real Paddle call in an environment
 * that isn't wired for real billing.
 */
export default {
  fetch: handle,

  async scheduled(controller, env, ctx) {
    const db = createDb(env.DB);

    ctx.waitUntil(runRetentionJob(env, controller.cron, db));

    if (env.BILLING_ENABLED === "true") {
      ctx.waitUntil(runScheduledDowngradesJob(env, controller.cron, db));
    }

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

      // Phase 10: a bounded, independent recovery pass for any policy-change
      // notification that failed to be created after its underlying
      // domain_change_event already committed (§16, §28). Deliberately its
      // own job/try/catch/scheduled_job_runs row, and deliberately NOT
      // gated behind schedulerPaused/maintenanceMode — it only reads
      // already-committed history and repairs missing notifications, it
      // never triggers a scan, so a notification-reconciliation failure can
      // never stop monitoring and a monitoring pause can never stop
      // reconciliation.
      ctx.waitUntil(runNotificationReconciliationJob(env, controller.cron, db));
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

async function runNotificationReconciliationJob(
  env: Env,
  cronExpression: string,
  db: ReturnType<typeof createDb>,
): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    const result = await reconcileMissingPolicyChangeNotifications(db, new Date());
    await env.DB.prepare(
      "INSERT INTO scheduled_job_runs (job_name, cron_expression, status, error_summary, started_at, completed_at) VALUES (?, ?, 'completed', ?, ?, ?)",
    )
      .bind(
        "notification_reconciliation",
        cronExpression,
        `scanned=${result.scanned} created=${result.created}`,
        startedAt,
        new Date().toISOString(),
      )
      .run();
  } catch (error) {
    await recordFailedJob(env, "notification_reconciliation", cronExpression, startedAt, error);
  }
}

async function runScheduledDowngradesJob(
  env: Env,
  cronExpression: string,
  db: ReturnType<typeof createDb>,
): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    const result = await applyDueScheduledDowngrades(db, {
      PADDLE_API_KEY: env.PADDLE_API_KEY,
      PADDLE_ENVIRONMENT: env.PADDLE_ENVIRONMENT,
    });
    await env.DB.prepare(
      "INSERT INTO scheduled_job_runs (job_name, cron_expression, status, error_summary, started_at, completed_at) VALUES (?, ?, 'completed', ?, ?, ?)",
    )
      .bind(
        "scheduled_plan_changes",
        cronExpression,
        `applied=${result.applied} failed=${result.failed}`,
        startedAt,
        new Date().toISOString(),
      )
      .run();
  } catch (error) {
    await recordFailedJob(env, "scheduled_plan_changes", cronExpression, startedAt, error);
  }
}

async function runRetentionJob(
  env: Env,
  cronExpression: string,
  db: ReturnType<typeof createDb>,
): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    const result = await runDataRetentionPurge(db, new Date(), {
      agencyLogosBucket: env.AGENCY_LOGOS,
    });
    // Phase 11 (Stage 11D): a per-category failure no longer aborts the
    // whole job (see data-retention.ts's failure-isolation doc comment) —
    // reflect that honestly rather than always recording "completed". A
    // backlog that hit its per-run chunk cap is expected, bounded, normal
    // operation (it resolves itself over the next few runs), not an error,
    // so it's noted in the summary text but doesn't change the status.
    const errorDetail = Object.entries(result.categories)
      .filter(([, c]) => c.error !== null)
      .map(([name, c]) => `${name}:${c.error}`)
      .join("; ");
    await env.DB.prepare(
      "INSERT INTO scheduled_job_runs (job_name, cron_expression, status, error_summary, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(
        "data_retention_purge",
        cronExpression,
        result.hasErrors ? "completed_with_errors" : "completed",
        `anonymous_scans=${result.anonymousScansDeleted} domain_scans=${result.domainScansDeleted} accounts=${result.accountsPurged} entitlements_expired=${result.entitlementsExpired} expired_continuations=${result.expiredContinuationsDeleted} orphaned_agency_logos=${result.orphanedAgencyLogosDeleted}` +
          (result.hasBacklog ? " backlog_remaining=true" : "") +
          (errorDetail ? ` errors=[${errorDetail}]` : ""),
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
  BILLING_ENABLED: string;
  PADDLE_API_KEY: string;
  PADDLE_ENVIRONMENT: "sandbox" | "production";
  AGENCY_LOGOS: R2Bucket;
};
