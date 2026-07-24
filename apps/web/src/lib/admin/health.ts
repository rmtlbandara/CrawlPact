import { desc, eq, sql } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { getBoolConfig } from "../runtime-config";

export type SystemStatus = "operational" | "degraded" | "maintenance";

/**
 * A real, minimal status derived from actual data (never a hardcoded "all
 * good" claim — SRS §28.10, the mission's "never present fabricated data as
 * a real outcome" rule applies to operational status too, not just scan
 * results). Reachability of D1 itself is implied by this function
 * completing at all, since it's the same binding every other query uses.
 */
export async function getSystemStatusSummary(
  db: Database,
): Promise<{ status: SystemStatus; reasons: string[] }> {
  const reasons: string[] = [];

  const maintenanceMode = await getBoolConfig(db, "maintenance_mode", false);
  if (maintenanceMode) {
    return { status: "maintenance", reasons: ["Maintenance mode is enabled."] };
  }

  const recentJobs = await db
    .select({
      jobName: schema.scheduledJobRuns.jobName,
      status: schema.scheduledJobRuns.status,
      startedAt: schema.scheduledJobRuns.startedAt,
    })
    .from(schema.scheduledJobRuns)
    .orderBy(desc(schema.scheduledJobRuns.startedAt))
    .limit(20);

  const latestByJob = new Map<string, (typeof recentJobs)[number]>();
  for (const job of recentJobs) {
    if (!latestByJob.has(job.jobName)) latestByJob.set(job.jobName, job);
  }
  for (const [jobName, job] of latestByJob) {
    if (job.status === "failed") reasons.push(`Last "${jobName}" run failed.`);
    const ageMs = Date.now() - new Date(job.startedAt).getTime();
    if (job.status === "running" && ageMs > 15 * 60 * 1000) {
      reasons.push(`"${jobName}" has been running for over 15 minutes — may be stuck.`);
    }
  }

  const [recentInvalidSignatures] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.securityEvents)
    .where(
      sql`${schema.securityEvents.eventType} = 'invalid_paddle_signature' and ${schema.securityEvents.createdAt} >= ${new Date(Date.now() - 60 * 60 * 1000).toISOString()}`,
    );
  if ((recentInvalidSignatures?.n ?? 0) > 5) {
    reasons.push("Elevated invalid Paddle webhook signatures in the last hour.");
  }

  return { status: reasons.length === 0 ? "operational" : "degraded", reasons };
}

export type ComponentHealth = { name: string; status: SystemStatus; detail: string };

/** Per-component breakdown for the dedicated /admin/health page (SRS §28.10). */
export async function getComponentHealth(db: Database): Promise<ComponentHealth[]> {
  const summary = await getSystemStatusSummary(db);

  const [lastMonitoringJob] = await db
    .select()
    .from(schema.scheduledJobRuns)
    .where(eq(schema.scheduledJobRuns.jobName, "monitoring_sweep"))
    .orderBy(desc(schema.scheduledJobRuns.startedAt))
    .limit(1);

  const [lastRetentionJob] = await db
    .select()
    .from(schema.scheduledJobRuns)
    .where(eq(schema.scheduledJobRuns.jobName, "data_retention_purge"))
    .orderBy(desc(schema.scheduledJobRuns.startedAt))
    .limit(1);

  const [recentWebhookFailures] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.webhookEvents)
    .where(sql`${schema.webhookEvents.status} in ('failed', 'permanently_failed')`);

  const [recentAuthFailures] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.securityEvents)
    .where(
      sql`${schema.securityEvents.eventType} = 'auth_failure' and ${schema.securityEvents.createdAt} >= ${new Date(Date.now() - 60 * 60 * 1000).toISOString()}`,
    );

  return [
    { name: "D1 database", status: "operational", detail: "Reachable (this page loaded from it)." },
    {
      name: "API",
      status: summary.status === "maintenance" ? "maintenance" : "operational",
      detail:
        summary.status === "maintenance"
          ? "Maintenance mode is enabled."
          : "Serving requests normally.",
    },
    {
      name: "Scheduler / monitoring sweep",
      status: lastMonitoringJob?.status === "failed" ? "degraded" : "operational",
      detail: lastMonitoringJob
        ? `Last run ${lastMonitoringJob.startedAt}: ${lastMonitoringJob.status}.`
        : "No monitoring sweep has run yet.",
    },
    {
      name: "Data retention job",
      status: lastRetentionJob?.status === "failed" ? "degraded" : "operational",
      detail: lastRetentionJob
        ? `Last run ${lastRetentionJob.startedAt}: ${lastRetentionJob.status}.`
        : "No retention job has run yet.",
    },
    {
      name: "Paddle webhook processing",
      status: (recentWebhookFailures?.n ?? 0) > 10 ? "degraded" : "operational",
      detail: `${recentWebhookFailures?.n ?? 0} webhook event(s) currently in a failed state.`,
    },
    {
      name: "Authentication",
      status: (recentAuthFailures?.n ?? 0) > 50 ? "degraded" : "operational",
      detail: `${recentAuthFailures?.n ?? 0} authentication failure(s) in the last hour.`,
    },
  ];
}
