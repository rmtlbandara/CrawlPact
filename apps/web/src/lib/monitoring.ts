import { and, eq, isNull, lte, or } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { PolicyPreset } from "@crawlpact/policy";
import { recordScheduledScanOutcome } from "./domains";
import { createNotification } from "./notifications";
import { getActiveRegistry } from "./registry-data";
import { runAudit } from "./run-audit";
import { persistScan } from "./persist-scan";
import { computeNextScanAt } from "./scan-scheduling";
import { getBlockedTargetPatterns } from "./blocked-targets";
import { getIntConfig } from "./runtime-config";

/**
 * Scheduled monitoring sweep (SRS §25, Part 2 Step 15). Invoked from
 * `worker.ts`'s `scheduled()` export on the cron declared in
 * wrangler.jsonc, and directly from tests — this function has no
 * Cloudflare-specific dependency itself, only `Database`.
 */

export const MAX_DOMAINS_PER_SWEEP = 20;
export const FAILURE_PAUSE_THRESHOLD = 5;
const CLAIM_LOCK_MINUTES = 15;

type DomainRow = typeof schema.domains.$inferSelect;

/**
 * Selects due domains and atomically claims each one by moving its
 * `next_scan_at` into the future before scanning. D1 serialises writes to a
 * single database, so a second concurrent sweep's claim UPDATE (same WHERE
 * clause) affects zero rows for anything already claimed here — this is
 * the whole idempotency/lock mechanism, no separate lock table needed. If
 * this process crashes mid-scan, the domain self-heals: it becomes due
 * again once the lock window elapses.
 */
async function claimDueDomains(
  db: Database,
  limit: number,
  now: Date,
  claimLockMinutes: number = CLAIM_LOCK_MINUTES,
): Promise<DomainRow[]> {
  const nowIso = now.toISOString();
  const candidates = await db
    .select()
    .from(schema.domains)
    .where(
      and(
        eq(schema.domains.monitoringState, "active"),
        isNull(schema.domains.deletedAt),
        or(isNull(schema.domains.nextScanAt), lte(schema.domains.nextScanAt, nowIso)),
      ),
    )
    .limit(limit);

  const dueCandidates = candidates.filter((c) => c.monitoringFrequency !== "none");
  const lockUntil = new Date(now.getTime() + claimLockMinutes * 60 * 1000).toISOString();
  const claimed: DomainRow[] = [];

  for (const candidate of dueCandidates) {
    const result = await db
      .update(schema.domains)
      .set({ nextScanAt: lockUntil })
      .where(
        and(
          eq(schema.domains.id, candidate.id),
          or(isNull(schema.domains.nextScanAt), lte(schema.domains.nextScanAt, nowIso)),
        ),
      )
      .returning({ id: schema.domains.id });
    if (result.length > 0) claimed.push(candidate);
  }
  return claimed;
}

type CrawlerResultRow = { crawlerId: string; result: string };

type ScanDrift = {
  crawlerResultChanges: { crawlerId: string; from: string; to: string }[];
  registryChanged: boolean;
};

/**
 * Compares evaluated crawler *results* (not raw robots.txt bytes) between
 * two scans — this is what makes drift detection semantic: a whitespace or
 * comment-only robots.txt edit changes no crawler's result and produces no
 * drift, while a real permission change always does.
 */
async function computeScanDrift(
  db: Database,
  previousScanId: string,
  currentScanId: string,
  currentRegistryVersionId: string,
): Promise<ScanDrift> {
  const [previousResults, currentResults, previousScanRow] = await Promise.all([
    db
      .select({
        crawlerId: schema.scanCrawlerResults.crawlerId,
        result: schema.scanCrawlerResults.result,
      })
      .from(schema.scanCrawlerResults)
      .where(eq(schema.scanCrawlerResults.scanId, previousScanId)),
    db
      .select({
        crawlerId: schema.scanCrawlerResults.crawlerId,
        result: schema.scanCrawlerResults.result,
      })
      .from(schema.scanCrawlerResults)
      .where(eq(schema.scanCrawlerResults.scanId, currentScanId)),
    db
      .select({ registryVersionId: schema.scans.registryVersionId })
      .from(schema.scans)
      .where(eq(schema.scans.id, previousScanId))
      .limit(1),
  ]);

  const previousByCrawler = new Map<string, string>(
    (previousResults as CrawlerResultRow[]).map((r) => [r.crawlerId, r.result]),
  );
  const changes: ScanDrift["crawlerResultChanges"] = [];
  for (const current of currentResults as CrawlerResultRow[]) {
    const previous = previousByCrawler.get(current.crawlerId);
    if (previous !== undefined && previous !== current.result) {
      changes.push({ crawlerId: current.crawlerId, from: previous, to: current.result });
    }
  }

  return {
    crawlerResultChanges: changes,
    registryChanged: previousScanRow[0]?.registryVersionId !== currentRegistryVersionId,
  };
}

async function handleScanSuccess(
  db: Database,
  domain: DomainRow,
  scanId: string,
  auditResult: Awaited<ReturnType<typeof runAudit>>,
  registryVersionId: string,
): Promise<void> {
  if (domain.lastScanId) {
    const drift = await computeScanDrift(db, domain.lastScanId, scanId, registryVersionId);
    if (drift.crawlerResultChanges.length > 0) {
      await db.insert(schema.scanDiffs).values({
        id: crypto.randomUUID(),
        domainId: domain.id,
        previousScanId: domain.lastScanId,
        currentScanId: scanId,
        diffType: drift.registryChanged ? "registry_drift" : "website_drift",
        summary: `${drift.crawlerResultChanges.length} crawler result${drift.crawlerResultChanges.length === 1 ? "" : "s"} changed`,
        details: JSON.stringify(drift.crawlerResultChanges),
        createdAt: new Date().toISOString(),
      });

      const hasCritical = auditResult.findings.some((f) => f.severity === "critical");
      const hasHigh = auditResult.findings.some((f) => f.severity === "high");
      if (drift.registryChanged) {
        await createNotification(
          db,
          domain.ownerUserId,
          domain.id,
          "registry_drift",
          `${domain.displayName}: crawler registry update changed policy evaluation`,
          `A new crawler registry release changed how ${drift.crawlerResultChanges.length} crawler${drift.crawlerResultChanges.length === 1 ? "" : "s"} evaluate against ${domain.displayName}'s policy.`,
        );
      } else if (hasCritical || hasHigh) {
        await createNotification(
          db,
          domain.ownerUserId,
          domain.id,
          hasCritical ? "critical_policy_change" : "high_severity_policy_change",
          `${domain.displayName}: AI crawler policy changed`,
          `Monitoring detected a change in how ${drift.crawlerResultChanges.length} crawler${drift.crawlerResultChanges.length === 1 ? "" : "s"} are evaluated against ${domain.displayName}'s policy.`,
        );
      }
      // A drift with only low/medium-severity implications is recorded in
      // scan_diffs (visible in history) but does not interrupt the user —
      // avoids notification fatigue for low-signal changes.
    }
  }

  await recordScheduledScanOutcome(db, domain.id, {
    succeeded: true,
    scanId,
    score: auditResult.score.state === "scored" ? auditResult.score.value : null,
    nextScanAt: computeNextScanAt(domain.monitoringFrequency),
  });
}

function backoffNextScanAt(failureCount: number, from: Date): string {
  const days = Math.min(2 ** Math.max(failureCount - 1, 0), 14);
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function handleScanFailure(
  db: Database,
  domain: DomainRow,
  scanId: string,
  now: Date,
  failureThreshold: number = FAILURE_PAUSE_THRESHOLD,
): Promise<void> {
  const newFailureCount = domain.consecutiveFailureCount + 1;
  const pause = newFailureCount >= failureThreshold;

  await recordScheduledScanOutcome(db, domain.id, {
    succeeded: false,
    scanId,
    nextScanAt: pause ? null : backoffNextScanAt(newFailureCount, now),
    pause,
  });

  if (pause) {
    await createNotification(
      db,
      domain.ownerUserId,
      domain.id,
      "monitoring_paused",
      `Monitoring paused for ${domain.displayName}`,
      `${domain.displayName} could not be scanned ${failureThreshold} times in a row. Monitoring has been paused — resume it once the site is reachable again.`,
    );
  } else if (newFailureCount >= 2) {
    // Skip notifying on the very first failure — a single transient
    // network blip isn't worth interrupting the user for.
    await createNotification(
      db,
      domain.ownerUserId,
      domain.id,
      "resource_failure",
      `${domain.displayName} could not be scanned`,
      `This is attempt ${newFailureCount} of ${failureThreshold} before monitoring pauses automatically.`,
    );
  }
}

export type MonitoringSweepResult = {
  domainsSelected: number;
  scansCompleted: number;
  scansFailed: number;
};

export type RunAuditFn = typeof runAudit;

/**
 * `runAuditFn` defaults to the real scanner but is injectable so tests can
 * exercise every bit of orchestration here (claiming, locking, drift
 * detection, backoff/pause, notifications) against a real D1 database
 * without depending on live network access — `runAudit` itself already has
 * its own dedicated unit tests at the scanner/policy layer.
 */
export async function runMonitoringSweep(
  db: Database,
  runAuditFn: RunAuditFn = runAudit,
): Promise<MonitoringSweepResult> {
  const now = new Date();
  const registry = await getActiveRegistry(db);
  if (!registry) return { domainsSelected: 0, scansCompleted: 0, scansFailed: 0 };

  const blocklist = await getBlockedTargetPatterns(db);
  const totalTimeoutMs = (await getIntConfig(db, "scan_total_timeout_seconds", 30)) * 1000;
  const batchSize = await getIntConfig(db, "monitoring_scan_batch_size", MAX_DOMAINS_PER_SWEEP);
  const claimLockMinutes = await getIntConfig(
    db,
    "monitoring_claim_lock_minutes",
    CLAIM_LOCK_MINUTES,
  );
  const failureThreshold = await getIntConfig(
    db,
    "monitoring_failure_pause_threshold",
    FAILURE_PAUSE_THRESHOLD,
  );
  const dueDomains = await claimDueDomains(db, batchSize, now, claimLockMinutes);
  let scansCompleted = 0;
  let scansFailed = 0;

  for (const domain of dueDomains) {
    const scanId = crypto.randomUUID();
    try {
      const auditResult = await runAuditFn(
        domain.canonicalOrigin,
        domain.preset as PolicyPreset,
        registry.crawlers,
        registry.rulesetVersionId,
        { blocklist, totalTimeoutMs },
      );

      await persistScan(
        db,
        {
          scanId,
          targetInput: domain.canonicalOrigin,
          preset: domain.preset,
          registryVersionId: registry.registryVersionId,
          rulesetVersionId: registry.rulesetVersionId,
          domainId: domain.id,
          triggeredBy: "scheduled",
        },
        auditResult,
      );

      const succeeded =
        auditResult.status === "completed" || auditResult.status === "completed_with_warnings";
      if (succeeded) {
        await handleScanSuccess(db, domain, scanId, auditResult, registry.registryVersionId);
        scansCompleted++;
      } else {
        await handleScanFailure(db, domain, scanId, now, failureThreshold);
        scansFailed++;
      }
    } catch {
      // runAudit/persistScan threw before a scans row existed — write a
      // minimal failure record instead of silently dropping the attempt,
      // so scan history and the failure-count/pause logic stay accurate.
      await persistFailedScanRecord(
        db,
        domain,
        scanId,
        registry.registryVersionId,
        registry.rulesetVersionId,
      );
      await handleScanFailure(db, domain, scanId, now, failureThreshold);
      scansFailed++;
    }
  }

  return { domainsSelected: dueDomains.length, scansCompleted, scansFailed };
}

async function persistFailedScanRecord(
  db: Database,
  domain: DomainRow,
  scanId: string,
  registryVersionId: string,
  rulesetVersionId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .insert(schema.scans)
    .values({
      id: scanId,
      domainId: domain.id,
      triggeredBy: "scheduled",
      triggeredByUserId: null,
      targetInput: domain.canonicalOrigin,
      canonicalOrigin: domain.canonicalOrigin,
      status: "internal_failure",
      preset: domain.preset,
      registryVersionId,
      rulesetVersionId,
      score: null,
      scoreState: "incomplete",
      externalRequestCount: 0,
      errorCategory: "unknown",
      startedAt: now,
      completedAt: now,
    })
    // Defensive: if persistScan already wrote a scans row for this scanId
    // before throwing partway through (e.g. a later insert in that
    // function failed), don't fail the fallback path on a PK collision —
    // the row already exists, which is all this call is trying to ensure.
    .onConflictDoNothing();
}
