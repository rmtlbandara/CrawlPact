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
    // Phase 11 (Stage 11D): a retention run that isolated a category
    // failure still reports "completed" for the categories that
    // succeeded, but the run as a whole is not fully healthy — surface it
    // the same as "failed" would be, just with its own wording.
    if (job.status === "completed_with_errors") {
      reasons.push(`Last "${jobName}" run completed with at least one category error.`);
    }
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

export type ComponentHealth = {
  name: string;
  status: SystemStatus;
  detail: string;
  /**
   * Public-status-and-changelog trust correction: whether this internal
   * signal represents real, current user-facing impact — as opposed to an
   * internal/administrative/historical concern with no effect on what a
   * visitor experiences right now. `getPublicStatus` (lib/status/public-status.ts)
   * only ever escalates a component's *public* status when this is `true`;
   * an internal `degraded` with `publicImpact: false` stays visible here,
   * in Super Admin, without ever reaching the public page. See
   * docs/architecture/INCIDENT_TRACKING_SYSTEM_DESIGN.md §6 and
   * docs/reports/PUBLIC_STATUS_AND_CHANGELOG_TRUST_CORRECTION_REPORT.md for
   * the real bug this fixed: an all-time (no time window) failed-webhook
   * count was permanently escalating the public "Billing and checkout"
   * component to Degraded performance based on a week-old, already-resolved
   * batch of failures with zero recent occurrences.
   */
  publicImpact: boolean;
};

const ONE_HOUR_MS = 60 * 60 * 1000;

/** Per-component breakdown for the dedicated /admin/health page (SRS §28.10). */
export async function getComponentHealth(db: Database): Promise<ComponentHealth[]> {
  const summary = await getSystemStatusSummary(db);
  const oneHourAgoIso = new Date(Date.now() - ONE_HOUR_MS).toISOString();

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

  // Public-status-and-changelog trust correction: previously had no time
  // window at all, so a single historical batch of failures (e.g. a bug
  // that was found and fixed days ago) kept this component — and therefore
  // the public "Billing and checkout" status — permanently degraded. Now
  // scoped to the last hour, matching this file's own existing convention
  // for `recentAuthFailures`/`recentInvalidSignatures` below.
  const [recentWebhookFailures] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.webhookEvents)
    .where(
      sql`${schema.webhookEvents.status} in ('failed', 'permanently_failed') and ${schema.webhookEvents.receivedAt} >= ${oneHourAgoIso}`,
    );

  const [recentAuthFailures] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.securityEvents)
    .where(
      sql`${schema.securityEvents.eventType} = 'auth_failure' and ${schema.securityEvents.createdAt} >= ${oneHourAgoIso}`,
    );

  const webhookFailureCount = recentWebhookFailures?.n ?? 0;
  const authFailureCount = recentAuthFailures?.n ?? 0;

  return [
    {
      name: "D1 database",
      status: "operational",
      detail: "Reachable (this page loaded from it).",
      publicImpact: false,
    },
    {
      name: "API",
      status: summary.status === "maintenance" ? "maintenance" : "operational",
      detail:
        summary.status === "maintenance"
          ? "Maintenance mode is enabled."
          : "Serving requests normally.",
      // Maintenance mode is a deliberate, real, user-facing state — every
      // other "API" concern this summary can report (stuck jobs, retention
      // errors, elevated invalid signatures) is an internal/administrative
      // signal with no direct effect on a page load right now.
      publicImpact: summary.status === "maintenance",
    },
    {
      name: "Scheduler / monitoring sweep",
      status: lastMonitoringJob?.status === "failed" ? "degraded" : "operational",
      detail: lastMonitoringJob
        ? `Last run ${lastMonitoringJob.startedAt}: ${lastMonitoringJob.status}.`
        : "No monitoring sweep has run yet.",
      // A failed scheduled sweep delays the *next* monitoring email/report —
      // it does not stop a visitor from using the site at the moment they
      // load the status page, so it is an internal operational concern, not
      // current public impact (matches the public-impact rule's own
      // "internal test/administrative concern" framing).
      publicImpact: false,
    },
    {
      name: "Data retention job",
      status:
        lastRetentionJob?.status === "failed" ||
        lastRetentionJob?.status === "completed_with_errors"
          ? "degraded"
          : "operational",
      detail: lastRetentionJob
        ? `Last run ${lastRetentionJob.startedAt}: ${lastRetentionJob.status}.`
        : "No retention job has run yet.",
      // Not mapped to any public component at all (purely an internal
      // background job) — never has public impact by construction.
      publicImpact: false,
    },
    {
      name: "Paddle webhook processing",
      status: webhookFailureCount > 0 ? "degraded" : "operational",
      detail: `${webhookFailureCount} webhook event(s) failed processing in the last hour.`,
      // A single recent failure surfaces internally immediately (this repo's
      // existing "no safe gradual zone" philosophy for real, unresolved
      // errors) but is not, on its own, evidence of widespread user impact —
      // Paddle retries delivery, and one failed processing attempt does not
      // mean a customer's purchase was lost. Three or more recent failures
      // is treated as a real pattern (matches the public-impact rule's own
      // "widespread elevated errors" example), not an isolated blip.
      publicImpact: webhookFailureCount >= 3,
    },
    {
      name: "Authentication",
      status: authFailureCount > 50 ? "degraded" : "operational",
      detail: `${authFailureCount} authentication failure(s) in the last hour.`,
      // Already time-windowed and already set at a bar well above normal
      // wrong-password/bad-passkey noise — a real breach past that bar is
      // treated as real, current public impact (visitors cannot reliably
      // sign in), unlike the background-job signals above.
      publicImpact: authFailureCount > 50,
    },
  ];
}
