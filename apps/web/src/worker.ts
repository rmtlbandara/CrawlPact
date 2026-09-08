import { handle } from "@astrojs/cloudflare/handler";
import { createDb } from "@crawlpact/database";
import { runMonitoringSweep } from "./lib/monitoring";
import { runDataRetentionPurge } from "./lib/data-retention";
import { applyDueScheduledDowngrades } from "./lib/billing/scheduled-downgrades";
import { reconcileMissingPolicyChangeNotifications } from "./lib/notification-reconciliation";
import { evaluateOperationalAlerts } from "./lib/admin/operational-alerts";
import { needsTrailingSlashRedirectPreview } from "./lib/route-registry";

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
  fetch: fetchWithPreviewSearchIsolation,

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

    // Phase 14: internal-only, deduplicated operational alerting (never a
    // public incident, never a third-party paging call). Runs on the same
    // daily cadence as the jobs above rather than its own trigger — it only
    // reads already-committed state (job runs, security events, webhook
    // events, monitoring backlog), so there is no separation-principle
    // reason (docs/operations/PHASE_14_SCHEDULED_JOB_ISOLATION_DECISION.md)
    // to give it a dedicated schedule. A failure here is logged, never
    // fatal to the Worker or to any other job.
    ctx.waitUntil(
      evaluateOperationalAlerts(db, env.DB, env.AGENCY_LOGOS).catch((error) => {
        console.error("evaluateOperationalAlerts failed:", error);
      }),
    );
  },
} satisfies ExportedHandler<Env>;

// Phase 14: each job now writes a "running" row before doing any work, and
// updates that same row on completion/failure, instead of a single post-hoc
// INSERT. This is what actually makes `detectSchedulerAnomalies`'s
// stuck/overlapping detection (lib/admin/scheduler.ts) able to observe
// anything real — previously no code path ever wrote a "running" row, so a
// Worker that died mid-job (CPU limit, uncaught exception outside the
// try/catch, eviction) left no trace at all, and "stuck"/"overlapping" were
// unreachable against real data. See docs/operations/PHASE_14_STATUS_OPERATIONS_BASELINE.md.
async function startJobRun(
  env: Env,
  jobName: string,
  cronExpression: string,
  startedAt: string,
): Promise<number | null> {
  const result = await env.DB.prepare(
    "INSERT INTO scheduled_job_runs (job_name, cron_expression, status, started_at) VALUES (?, ?, 'running', ?)",
  )
    .bind(jobName, cronExpression, startedAt)
    .run();
  return typeof result.meta.last_row_id === "number" ? result.meta.last_row_id : null;
}

async function finishJobRun(
  env: Env,
  runId: number | null,
  jobName: string,
  cronExpression: string,
  startedAt: string,
  fields: {
    status: "completed" | "completed_with_errors" | "failed";
    domainsSelected?: number;
    scansCreated?: number;
    scansCompleted?: number;
    scansFailed?: number;
    errorSummary?: string;
  },
): Promise<void> {
  const completedAt = new Date().toISOString();
  if (runId !== null) {
    await env.DB.prepare(
      "UPDATE scheduled_job_runs SET status = ?, domains_selected = ?, scans_created = ?, scans_completed = ?, scans_failed = ?, error_summary = ?, completed_at = ? WHERE id = ?",
    )
      .bind(
        fields.status,
        fields.domainsSelected ?? 0,
        fields.scansCreated ?? 0,
        fields.scansCompleted ?? 0,
        fields.scansFailed ?? 0,
        fields.errorSummary ?? null,
        completedAt,
        runId,
      )
      .run();
    return;
  }
  // The pre-flight INSERT itself failed to return a usable row id (should
  // not happen in practice, but never silently drop the completion record)
  // — fall back to a fresh row rather than losing this job run entirely.
  await env.DB.prepare(
    "INSERT INTO scheduled_job_runs (job_name, cron_expression, status, domains_selected, scans_created, scans_completed, scans_failed, error_summary, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      jobName,
      cronExpression,
      fields.status,
      fields.domainsSelected ?? 0,
      fields.scansCreated ?? 0,
      fields.scansCompleted ?? 0,
      fields.scansFailed ?? 0,
      fields.errorSummary ?? null,
      startedAt,
      completedAt,
    )
    .run();
}

async function runMonitoringJob(
  env: Env,
  cronExpression: string,
  db: ReturnType<typeof createDb>,
): Promise<void> {
  const startedAt = new Date().toISOString();
  const runId = await startJobRun(env, "monitoring_sweep", cronExpression, startedAt);
  try {
    const result = await runMonitoringSweep(db);
    await finishJobRun(env, runId, "monitoring_sweep", cronExpression, startedAt, {
      status: "completed",
      domainsSelected: result.domainsSelected,
      scansCreated: result.domainsSelected,
      scansCompleted: result.scansCompleted,
      scansFailed: result.scansFailed,
    });
  } catch (error) {
    await finishJobRun(env, runId, "monitoring_sweep", cronExpression, startedAt, {
      status: "failed",
      errorSummary: error instanceof Error ? error.message : String(error),
    });
  }
}

async function runNotificationReconciliationJob(
  env: Env,
  cronExpression: string,
  db: ReturnType<typeof createDb>,
): Promise<void> {
  const startedAt = new Date().toISOString();
  const runId = await startJobRun(env, "notification_reconciliation", cronExpression, startedAt);
  try {
    const result = await reconcileMissingPolicyChangeNotifications(db, new Date());
    await finishJobRun(env, runId, "notification_reconciliation", cronExpression, startedAt, {
      status: "completed",
      errorSummary: `scanned=${result.scanned} created=${result.created}`,
    });
  } catch (error) {
    await finishJobRun(env, runId, "notification_reconciliation", cronExpression, startedAt, {
      status: "failed",
      errorSummary: error instanceof Error ? error.message : String(error),
    });
  }
}

async function runScheduledDowngradesJob(
  env: Env,
  cronExpression: string,
  db: ReturnType<typeof createDb>,
): Promise<void> {
  const startedAt = new Date().toISOString();
  const runId = await startJobRun(env, "scheduled_plan_changes", cronExpression, startedAt);
  try {
    const result = await applyDueScheduledDowngrades(db, {
      PADDLE_API_KEY: env.PADDLE_API_KEY,
      PADDLE_ENVIRONMENT: env.PADDLE_ENVIRONMENT,
    });
    await finishJobRun(env, runId, "scheduled_plan_changes", cronExpression, startedAt, {
      status: "completed",
      errorSummary: `applied=${result.applied} failed=${result.failed}`,
    });
  } catch (error) {
    await finishJobRun(env, runId, "scheduled_plan_changes", cronExpression, startedAt, {
      status: "failed",
      errorSummary: error instanceof Error ? error.message : String(error),
    });
  }
}

async function runRetentionJob(
  env: Env,
  cronExpression: string,
  db: ReturnType<typeof createDb>,
): Promise<void> {
  const startedAt = new Date().toISOString();
  const runId = await startJobRun(env, "data_retention_purge", cronExpression, startedAt);
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
    await finishJobRun(env, runId, "data_retention_purge", cronExpression, startedAt, {
      status: result.hasErrors ? "completed_with_errors" : "completed",
      errorSummary:
        `anonymous_scans=${result.anonymousScansDeleted} domain_scans=${result.domainScansDeleted} accounts=${result.accountsPurged} entitlements_expired=${result.entitlementsExpired} expired_continuations=${result.expiredContinuationsDeleted} orphaned_agency_logos=${result.orphanedAgencyLogosDeleted} security_events=${result.securityEventsDeleted} read_notifications=${result.readNotificationsDeleted}` +
        (result.hasBacklog ? " backlog_remaining=true" : "") +
        (errorDetail ? ` errors=[${errorDetail}]` : ""),
    });
  } catch (error) {
    await finishJobRun(env, runId, "data_retention_purge", cronExpression, startedAt, {
      status: "failed",
      errorSummary: error instanceof Error ? error.message : String(error),
    });
  }
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

/**
 * Phase 20, P0: preview.crawlpact.com must never compete with production in
 * Google Search. `apps/web/src/middleware.ts` already sets `X-Robots-Tag` for
 * specific non-indexable path prefixes, but that only runs for SSR
 * responses — prerendered marketing pages (home, pricing's static siblings,
 * guides, crawlers, etc.) are served directly off the Workers Assets binding
 * and never reach Astro middleware at all (see that file's own doc comment).
 * `env.preview.assets.run_worker_first` (wrangler.jsonc) forces every
 * preview request through this Worker first — including ones that would
 * otherwise be served as a static asset — specifically so this wrapper can
 * unconditionally stamp every preview response, regardless of rendering
 * mode, before anything is returned to the client. Production does not set
 * `run_worker_first`, so this wrapper's preview branch is never reached in
 * production and asset-serving performance there is unaffected.
 *
 * `run_worker_first` has a second, confirmed side effect (verified locally,
 * 2026-09-07): it bypasses Cloudflare's edge-level `_redirects`/
 * `html_handling` processing for asset-matched paths entirely, since those
 * only run in front of the default asset-first dispatcher — a Worker's own
 * internal asset lookup doesn't re-trigger them. That would silently
 * regress the Phase 20 canonical trailing-slash redirect for every
 * prerendered page, on preview only, the moment `run_worker_first` is
 * enabled — so this wrapper redirects those paths itself, before ever
 * calling `handle()`, using the broader `needsTrailingSlashRedirectPreview`
 * (production keeps relying on `public/_redirects` alone; see that
 * function's doc comment in `route-registry.ts`).
 */
export async function fetchWithPreviewSearchIsolation(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (env.PUBLIC_APP_ENV === "preview") {
    const url = new URL(request.url);
    if (
      (request.method === "GET" || request.method === "HEAD") &&
      needsTrailingSlashRedirectPreview(url.pathname)
    ) {
      const target = new URL(`${url.pathname}/`, url.origin);
      target.search = url.search;
      return Response.redirect(target.toString(), 301);
    }
  }

  const response = await handle(request, env, ctx);
  if (env.PUBLIC_APP_ENV !== "preview") {
    return response;
  }
  const isolated = new Response(response.body, response);
  isolated.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  return isolated;
}

type Env = {
  DB: D1Database;
  AUDIT_ENGINE_ENABLED: string;
  BILLING_ENABLED: string;
  PADDLE_API_KEY: string;
  PADDLE_ENVIRONMENT: "sandbox" | "production";
  AGENCY_LOGOS: R2Bucket;
  PUBLIC_APP_ENV: string;
};
