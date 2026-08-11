import { and, desc, eq, isNull } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { detectSchedulerAnomalies } from "./scheduler";
import {
  getComponentHealth,
  getRecentAuthFailureCount,
  getRecentWebhookFailureCount,
} from "./health";
import { getOperationalCapacitySnapshot } from "./capacity";

/**
 * First-party, deduplicated internal operational alerting (Phase 14 §26/
 * §32-34). Derives every candidate from signals that already exist —
 * `detectSchedulerAnomalies` (Phase 10/11), `getComponentHealth` (webhook/
 * auth), `getOperationalCapacitySnapshot` (Phase 11 monitoring backlog) —
 * this module computes nothing new about the system, it only decides
 * whether a condition is worth a persistent, deduplicated alert row. See
 * docs/operations/OPERATIONAL_ALERT_MODEL.md.
 */

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertCandidate = {
  alertKey: string;
  severity: AlertSeverity;
  source: string;
  detail: string;
};

const WEBHOOK_FAILURE_WARNING_THRESHOLD = 3;
const AUTH_FAILURE_CRITICAL_THRESHOLD = 50;
const PLATFORM_FAILURE_WARNING_THRESHOLD = 5;

/**
 * Computes the current set of alert conditions from real, already-computed
 * signals — never simulated. Pure read, no writes.
 */
export async function computeAlertCandidates(
  db: Database,
  rawDb: D1Database,
  agencyLogos: R2Bucket,
): Promise<AlertCandidate[]> {
  const candidates: AlertCandidate[] = [];

  const [anomalies, componentHealth, capacity, webhookFailureCount, authFailureCount] =
    await Promise.all([
      detectSchedulerAnomalies(db),
      getComponentHealth(db),
      getOperationalCapacitySnapshot(db, rawDb, agencyLogos).catch(() => null),
      getRecentWebhookFailureCount(db),
      getRecentAuthFailureCount(db),
    ]);

  for (const anomaly of anomalies) {
    const severity: AlertSeverity =
      anomaly.type === "missed" || anomaly.type === "stuck" ? "critical" : "warning";
    candidates.push({
      alertKey: `scheduler.${anomaly.type}.${anomaly.jobName}`,
      severity,
      source: `scheduled_job_runs (${anomaly.jobName})`,
      detail: anomaly.detail,
    });
  }

  if (webhookFailureCount >= WEBHOOK_FAILURE_WARNING_THRESHOLD) {
    candidates.push({
      alertKey: "billing.webhook_processing_failures",
      severity: "warning",
      source: "webhook_events (last 1 hour)",
      detail: `${webhookFailureCount} webhook event(s) failed processing in the last hour.`,
    });
  }

  if (authFailureCount > AUTH_FAILURE_CRITICAL_THRESHOLD) {
    candidates.push({
      alertKey: "auth.failure_spike",
      severity: "critical",
      source: "security_events (auth_failure, last 1 hour)",
      detail: `${authFailureCount} authentication failure(s) in the last hour.`,
    });
  }

  const retentionComponent = componentHealth.find((c) => c.name === "Data retention job");
  if (retentionComponent?.status === "degraded") {
    candidates.push({
      alertKey: "retention.job_degraded",
      severity: "warning",
      source: "scheduled_job_runs (data_retention_purge)",
      detail: retentionComponent.detail,
    });
  }

  if (capacity) {
    if (capacity.monitoring.longOverdueActiveDomainCount > 0) {
      candidates.push({
        alertKey: "monitoring.backlog_critical",
        severity: "critical",
        source: "domains (monitoring backlog)",
        detail: `${capacity.monitoring.longOverdueActiveDomainCount} active domain(s) significantly overdue for scheduled monitoring.`,
      });
    }
    if (capacity.monitoring.platformFailureCountLast24h >= PLATFORM_FAILURE_WARNING_THRESHOLD) {
      candidates.push({
        alertKey: "monitoring.platform_failure_spike",
        severity: "warning",
        source: "scans (internal_failure, last 24h)",
        detail: `${capacity.monitoring.platformFailureCountLast24h} platform-side scan failures in the last 24 hours.`,
      });
    }
  }

  return candidates;
}

export type OperationalAlertRow = typeof schema.operationalAlerts.$inferSelect;

/**
 * Reconciles the candidate set against currently-open alert rows: opens a
 * new row for a never-seen key, bumps `last_seen_at`/`occurrence_count` for
 * a still-present key, and resolves any open row whose condition is no
 * longer present. One persistent condition produces exactly one row over
 * its lifetime, never one row per evaluation.
 */
export async function evaluateOperationalAlerts(
  db: Database,
  rawDb: D1Database,
  agencyLogos: R2Bucket,
  now: Date = new Date(),
): Promise<{ opened: number; updated: number; resolved: number }> {
  const nowIso = now.toISOString();
  const candidates = await computeAlertCandidates(db, rawDb, agencyLogos);
  const candidateKeys = new Set(candidates.map((c) => c.alertKey));

  const openRows = await db
    .select()
    .from(schema.operationalAlerts)
    .where(isNull(schema.operationalAlerts.resolvedAt));
  const openByKey = new Map(openRows.map((row) => [row.alertKey, row]));

  let opened = 0;
  let updated = 0;
  for (const candidate of candidates) {
    const existing = openByKey.get(candidate.alertKey);
    if (existing) {
      await db
        .update(schema.operationalAlerts)
        .set({
          lastSeenAt: nowIso,
          occurrenceCount: existing.occurrenceCount + 1,
          detail: candidate.detail,
          severity: candidate.severity,
        })
        .where(eq(schema.operationalAlerts.id, existing.id));
      updated += 1;
    } else {
      await db.insert(schema.operationalAlerts).values({
        alertKey: candidate.alertKey,
        severity: candidate.severity,
        source: candidate.source,
        detail: candidate.detail,
        firstSeenAt: nowIso,
        lastSeenAt: nowIso,
        occurrenceCount: 1,
      });
      opened += 1;
    }
  }

  let resolved = 0;
  for (const row of openRows) {
    if (!candidateKeys.has(row.alertKey)) {
      await db
        .update(schema.operationalAlerts)
        .set({ resolvedAt: nowIso })
        .where(eq(schema.operationalAlerts.id, row.id));
      resolved += 1;
    }
  }

  return { opened, updated, resolved };
}

export async function listActiveOperationalAlerts(db: Database): Promise<OperationalAlertRow[]> {
  return db
    .select()
    .from(schema.operationalAlerts)
    .where(isNull(schema.operationalAlerts.resolvedAt))
    .orderBy(desc(schema.operationalAlerts.lastSeenAt));
}

export async function listRecentOperationalAlerts(
  db: Database,
  limit = 50,
): Promise<OperationalAlertRow[]> {
  return db
    .select()
    .from(schema.operationalAlerts)
    .orderBy(desc(schema.operationalAlerts.lastSeenAt))
    .limit(limit);
}

export async function acknowledgeOperationalAlert(
  db: Database,
  alertId: number,
  userId: string,
): Promise<boolean> {
  const result = await db
    .update(schema.operationalAlerts)
    .set({ acknowledgedAt: new Date().toISOString(), acknowledgedByUserId: userId })
    .where(
      and(eq(schema.operationalAlerts.id, alertId), isNull(schema.operationalAlerts.resolvedAt)),
    );
  return (result.meta?.changes ?? 0) > 0;
}
