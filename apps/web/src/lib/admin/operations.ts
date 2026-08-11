import { sql } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { getStatusOverview, type StatusOverview } from "../status/public-status";
import { getOperationalCapacitySnapshot, type OperationalCapacitySnapshot } from "./capacity";
import { detectSchedulerAnomalies, type SchedulerAnomaly } from "./scheduler";
import { listActiveOperationalAlerts, type OperationalAlertRow } from "./operational-alerts";
import { getRegistryHealth, type RegistryHealthCheck } from "./registry-health";

/**
 * Composes the Super Admin operations control plane (Phase 14 §29-31) from
 * existing, already-tested modules — this file computes no new raw signal
 * itself, it only aggregates `getStatusOverview` (public+internal status),
 * `getOperationalCapacitySnapshot` (Phase 11 capacity), `detectSchedulerAnomalies`
 * (Phase 10/11 job health), and `listActiveOperationalAlerts` (Phase 14
 * deduplicated alerting), plus a small set of bounded reliability-trend
 * ratios derived from existing tables. See
 * docs/operations/SERVICE_LEVEL_INDICATORS.md for what each ratio means and
 * docs/operations/PHASE_14_INDEPENDENT_STATUS_PLANE_DECISION.md for why this
 * lives in the main Worker/D1 rather than a separate plane.
 */

export type ReliabilityWindowHours = 1 | 24 | 168 | 720; // 1h, 24h, 7d, 30d

export type RatioMetric = { numerator: number; denominator: number; percent: number | null };

function ratio(numerator: number, denominator: number): RatioMetric {
  return {
    numerator,
    denominator,
    percent: denominator === 0 ? null : Math.round((numerator / denominator) * 1000) / 10,
  };
}

export type ReliabilityTrends = {
  windowHours: ReliabilityWindowHours;
  monitoringTimeliness: RatioMetric;
  jobReliability: RatioMetric;
  billingProcessingReliability: RatioMetric;
  authFailureCount: number;
  alertsOpenedInWindow: number;
};

/**
 * SLI ratios for one bounded time window (§16, §102) — every query is
 * scoped to `startedAt`/`received_at`/`created_at` >= cutoff, never an
 * unbounded full-table scan. Denominator 0 renders as "Insufficient
 * historical data" by the caller, never a misleading bare percentage
 * (same low-volume-data rule Phase 13 established for product analytics).
 */
export async function getReliabilityTrends(
  db: Database,
  windowHours: ReliabilityWindowHours,
  now: Date = new Date(),
): Promise<ReliabilityTrends> {
  const cutoffIso = new Date(now.getTime() - windowHours * 60 * 60 * 1000).toISOString();

  const [scheduledScanRows] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.scans)
    .where(
      sql`${schema.scans.triggeredBy} = 'scheduled' and ${schema.scans.startedAt} >= ${cutoffIso}`,
    );
  const [scheduledScanSuccessRows] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.scans)
    .where(
      sql`${schema.scans.triggeredBy} = 'scheduled' and ${schema.scans.startedAt} >= ${cutoffIso} and ${schema.scans.status} in ('completed', 'completed_with_warnings')`,
    );

  const [jobRunRows] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.scheduledJobRuns)
    .where(sql`${schema.scheduledJobRuns.startedAt} >= ${cutoffIso}`);
  const [jobRunSuccessRows] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.scheduledJobRuns)
    .where(
      sql`${schema.scheduledJobRuns.startedAt} >= ${cutoffIso} and ${schema.scheduledJobRuns.status} = 'completed'`,
    );

  const [webhookRows] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.webhookEvents)
    .where(sql`${schema.webhookEvents.receivedAt} >= ${cutoffIso}`);
  const [webhookSuccessRows] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.webhookEvents)
    .where(
      sql`${schema.webhookEvents.receivedAt} >= ${cutoffIso} and ${schema.webhookEvents.status} = 'processed'`,
    );

  const [authFailureRows] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.securityEvents)
    .where(
      sql`${schema.securityEvents.eventType} = 'auth_failure' and ${schema.securityEvents.createdAt} >= ${cutoffIso}`,
    );

  const [alertsOpenedRows] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.operationalAlerts)
    .where(sql`${schema.operationalAlerts.firstSeenAt} >= ${cutoffIso}`);

  return {
    windowHours,
    monitoringTimeliness: ratio(scheduledScanSuccessRows?.n ?? 0, scheduledScanRows?.n ?? 0),
    jobReliability: ratio(jobRunSuccessRows?.n ?? 0, jobRunRows?.n ?? 0),
    billingProcessingReliability: ratio(webhookSuccessRows?.n ?? 0, webhookRows?.n ?? 0),
    authFailureCount: authFailureRows?.n ?? 0,
    alertsOpenedInWindow: alertsOpenedRows?.n ?? 0,
  };
}

export type OperationsSummary = {
  checkedAt: string;
  status: StatusOverview;
  capacity: OperationalCapacitySnapshot;
  schedulerAnomalies: SchedulerAnomaly[];
  activeAlerts: OperationalAlertRow[];
  trends: ReliabilityTrends[];
  /** Phase 15 §125 — read-only, internal-only (see registry-health.ts). */
  registryHealth: RegistryHealthCheck;
  /**
   * Deliberately null — a Worker binding has no way to read its own
   * deployment commit SHA / Worker version at runtime (same "genuinely
   * unobtainable, say so honestly" discipline as `capacity.ts`'s
   * `notAvailableFromThisWorker`). The authoritative source is the most
   * recent `deploy-production.yml` run's job summary — see
   * docs/operations/PHASE_14_STATUS_OPERATIONS_BASELINE.md "Deployment
   * evidence".
   */
  deployment: null;
};

export async function getOperationsSummary(
  db: Database,
  rawDb: D1Database,
  agencyLogos: R2Bucket,
  now: Date = new Date(),
): Promise<OperationsSummary> {
  const [
    status,
    capacity,
    schedulerAnomalies,
    activeAlerts,
    trends1h,
    trends24h,
    trends7d,
    trends30d,
    registryHealth,
  ] = await Promise.all([
    getStatusOverview(db),
    getOperationalCapacitySnapshot(db, rawDb, agencyLogos),
    detectSchedulerAnomalies(db),
    listActiveOperationalAlerts(db),
    getReliabilityTrends(db, 1, now),
    getReliabilityTrends(db, 24, now),
    getReliabilityTrends(db, 168, now),
    getReliabilityTrends(db, 720, now),
    getRegistryHealth(db),
  ]);

  return {
    checkedAt: now.toISOString(),
    status,
    capacity,
    schedulerAnomalies,
    activeAlerts,
    trends: [trends1h, trends24h, trends7d, trends30d],
    deployment: null,
    registryHealth,
  };
}
