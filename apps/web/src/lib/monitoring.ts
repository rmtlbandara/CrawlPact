import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { PolicyPreset } from "@crawlpact/policy";
import { recordScheduledScanOutcome } from "./domains";
import { createNotificationOnce, upsertGroupedNotification } from "./notifications";
import { buildPolicyChangeNotificationIntent } from "./notification-intents";
import { getActiveRegistry } from "./registry-data";
import { runAudit } from "./run-audit";
import { persistScan } from "./persist-scan";
import { computeNextScanAt } from "./scan-scheduling";
import { getBlockedTargetPatterns } from "./blocked-targets";
import { getIntConfig } from "./runtime-config";
import { generateTimelineEvent, type GeneratedTimelineEvent } from "./domain-timeline";

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
 *
 * Phase 11 (RISK-008, fair scheduling): ordered by `next_scan_at` ascending
 * — confirmed via a real D1 probe that SQLite sorts NULL first in ASC
 * order, so a domain that has never been scanned sorts ahead of every
 * timestamped one, and among timestamped domains the longest-overdue sorts
 * first. Without this, when the daily due backlog exceeds `batchSize`, D1's
 * unspecified row order (effectively insertion order) meant the same
 * early-created domains could win every sweep indefinitely while a
 * later-created, equally- or more-overdue domain starved. This makes the
 * batch cap's selection fair by actual overdue-ness, not creation date.
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
    .orderBy(asc(schema.domains.nextScanAt))
    .limit(limit);

  // Phase 8: skip a domain a manual rescan currently holds
  // (domains.scan_lock_until, apps/web/src/lib/scan-lock.ts) — it self-heals
  // next sweep once that short-lived lock expires, same as any other claim.
  const dueCandidates = candidates.filter(
    (c) => c.monitoringFrequency !== "none" && (!c.scanLockUntil || c.scanLockUntil <= nowIso),
  );
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

/**
 * Phase 10 ordering (§14 — "monitoring truth before notification
 * generation"): the Phase 8 timeline event is generated and the domain's
 * authoritative monitoring state is committed *first*; only then is a
 * notification attempted, wrapped in its own try/catch that can never
 * propagate. Before this phase, notification creation ran ahead of
 * `recordScheduledScanOutcome` and was not failure-isolated at all — a
 * thrown error from `createNotification` would escape into
 * `runMonitoringSweep`'s outer `catch`, which then treated an otherwise
 * successful scan as a hard failure (a duplicate `scans` row attempt via
 * `persistFailedScanRecord`, plus an undeserved `handleScanFailure` call
 * incrementing `consecutiveFailureCount`). See
 * docs/architecture/NOTIFICATION_RELIABILITY_ARCHITECTURE.md and the
 * "Required Monitoring Outcome Isolation Tests" in
 * monitoring-outcome-isolation.integration.test.ts.
 */
async function handleScanSuccess(
  db: Database,
  domain: DomainRow,
  scanId: string,
  auditResult: Awaited<ReturnType<typeof runAudit>>,
  registryVersionId: string,
): Promise<void> {
  // Kept purely for scan-history/audit-trail purposes (Scan history's own
  // diff view) — no longer consulted for the notification decision, which
  // is now driven entirely by the Phase 8 attribution event below. Using
  // this cruder registryChanged/hasCritical check for notifications used to
  // mislabel a *mixed* (both website and registry) change as purely
  // registry-driven, since a registryChanged=true check short-circuited
  // before the website-side severity check ever ran.
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
    }
  }

  // Phase 8: generated unconditionally — the timeline's own attribution
  // model compares raw resource content and registry identity directly, so
  // it can detect a real website or registry change even when the evaluated
  // crawler outcome happened to stay the same. Returns null when nothing
  // material changed (a genuine no-op, writes nothing).
  const event = await safeGenerateTimelineEvent(db, domain.id, domain.lastScanId, scanId);

  // Authoritative monitoring state commits before notification generation
  // is allowed to run at all.
  await recordScheduledScanOutcome(db, domain.id, {
    succeeded: true,
    scanId,
    score: auditResult.score.state === "scored" ? auditResult.score.value : null,
    nextScanAt: computeNextScanAt(domain.monitoringFrequency),
  });

  if (event) await safeNotifyPolicyChange(db, domain, event);
}

/**
 * Phase 8: timeline-event generation must never block scan completion or
 * monitoring status — a failure here (e.g. a transient D1 error) is
 * swallowed, not rethrown. `console.error` gives Workers Logs real
 * visibility without an unhandled-rejection crash.
 */
async function safeGenerateTimelineEvent(
  db: Database,
  domainId: string,
  previousScanId: string | null,
  currentScanId: string,
): Promise<GeneratedTimelineEvent | null> {
  try {
    return await generateTimelineEvent(db, { domainId, previousScanId, currentScanId });
  } catch (error) {
    console.error("Timeline event generation failed", { domainId, currentScanId, error });
    return null;
  }
}

/**
 * Phase 10 notification-failure isolation (§15, Option A — "best-effort
 * after authoritative commit"): runs strictly after monitoring truth is
 * already committed, and never throws into its caller. A failure here is
 * recoverable — `reconcileMissingPolicyChangeNotifications`
 * (notification-reconciliation.ts) picks up any domain_change_event that
 * ended up without a corresponding notification on its own next run.
 */
async function safeNotifyPolicyChange(
  db: Database,
  domain: DomainRow,
  event: GeneratedTimelineEvent,
): Promise<void> {
  try {
    const intent = buildPolicyChangeNotificationIntent(domain, event);
    if (!intent) return;
    await createNotificationOnce(db, {
      userId: domain.ownerUserId,
      domainId: domain.id,
      ...intent,
    });
  } catch (error) {
    console.error("Policy-change notification generation failed", {
      domainId: domain.id,
      eventId: event.id,
      error,
    });
  }
}

function backoffNextScanAt(failureCount: number, from: Date): string {
  const days = Math.min(2 ** Math.max(failureCount - 1, 0), 14);
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Phase 10 failure classification (§22-23): a scan failure is either
 * `"target"` (the audit ran to completion but couldn't successfully reach or
 * parse the target — the existing `AuditResult.status` union already
 * distinguishes this from success) or `"platform"` (CrawlPact's own
 * processing threw before a result existed at all — a D1 error, an uncaught
 * scanner/orchestrator exception). Only a target-side failure counts toward
 * `consecutiveFailureCount`/the pause threshold — a platform-side failure
 * must never pause a customer's monitoring or make it look like their site
 * is failing when the fault was ours.
 */
export type ScanFailureClassification = "target" | "platform";

async function handleScanFailure(
  db: Database,
  domain: DomainRow,
  scanId: string,
  now: Date,
  classification: ScanFailureClassification,
  failureThreshold: number = FAILURE_PAUSE_THRESHOLD,
): Promise<void> {
  // Phase 8: only meaningful when there's a previous successful scan to
  // compare against — see generateTimelineEvent's own no-previous-scan
  // guard for why a failed *first* scan produces no event.
  await safeGenerateTimelineEvent(db, domain.id, domain.lastScanId, scanId);

  if (classification === "platform") {
    await recordScheduledScanOutcome(db, domain.id, {
      succeeded: false,
      scanId,
      platformFailure: true,
    });
    // Internal operational signal only — never a user-facing notification.
    // A CrawlPact-side failure is not something the user can act on, and
    // (unlike a target failure) it deliberately did not advance any
    // failure-episode/pause state, so "attempt N of threshold" framing would
    // be actively misleading here. Super Admin visibility comes from
    // scans.status = 'internal_failure' row counts
    // (apps/web/src/lib/admin/capacity.ts), not a separate metrics table.
    console.error("Platform-side scan failure", { domainId: domain.id, scanId });
    return;
  }

  const newFailureCount = domain.consecutiveFailureCount + 1;
  const pause = newFailureCount >= failureThreshold;
  const failureEpisodeId = domain.failureEpisodeId ?? crypto.randomUUID();

  await recordScheduledScanOutcome(db, domain.id, {
    succeeded: false,
    scanId,
    nextScanAt: pause ? null : backoffNextScanAt(newFailureCount, now),
    pause,
    failureEpisodeId,
  });

  await safeNotifyTargetFailure(db, domain, {
    failureEpisodeId,
    newFailureCount,
    pause,
    failureThreshold,
  });
}

async function safeNotifyTargetFailure(
  db: Database,
  domain: DomainRow,
  params: {
    failureEpisodeId: string;
    newFailureCount: number;
    pause: boolean;
    failureThreshold: number;
  },
): Promise<void> {
  try {
    if (params.pause) {
      await createNotificationOnce(db, {
        userId: domain.ownerUserId,
        domainId: domain.id,
        type: "monitoring_paused",
        category: "monitoring_health",
        priority: "high",
        title: `Monitoring paused for ${domain.displayName}`,
        body: `CrawlPact could not complete ${params.failureThreshold} scheduled audits in a row for ${domain.displayName}, so automatic monitoring has been paused. Review the domain before resuming monitoring.`,
        sourceType: "scan_failure_episode",
        sourceId: params.failureEpisodeId,
        dedupeKey: `monitoring_paused:${params.failureEpisodeId}`,
        actionPath: `/app/domains/${domain.id}`,
      });
    } else if (params.newFailureCount >= 2) {
      // Skip notifying on the very first failure — a single transient
      // network blip isn't worth interrupting the user for
      // (docs/product/NOTIFICATION_FATIGUE_AND_GROUPING_POLICY.md).
      await upsertGroupedNotification(db, {
        userId: domain.ownerUserId,
        domainId: domain.id,
        type: "resource_failure",
        category: "monitoring_health",
        priority: "normal",
        title: `${domain.displayName} could not be scanned`,
        body: `CrawlPact could not complete the scheduled audit for ${domain.displayName}. This is attempt ${params.newFailureCount} of ${params.failureThreshold} before monitoring pauses automatically; it will retry on the usual schedule.`,
        sourceType: "scan_failure_episode",
        sourceId: params.failureEpisodeId,
        dedupeKey: `resource_failure:${params.failureEpisodeId}`,
        actionPath: `/app/domains/${domain.id}`,
        occurrenceCount: params.newFailureCount,
      });
    }
  } catch (error) {
    console.error("Target-failure notification generation failed", {
      domainId: domain.id,
      failureEpisodeId: params.failureEpisodeId,
      error,
    });
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
        // A completed audit run that legitimately couldn't reach/parse the
        // target (target_unavailable/incomplete) — target-side, per
        // ScanFailureClassification's doc comment.
        await handleScanFailure(db, domain, scanId, now, "target", failureThreshold);
        scansFailed++;
      }
    } catch {
      // runAudit/persistScan threw before a `scans` row existed at all — the
      // target itself was never meaningfully attempted/shown to be at
      // fault, so this is unambiguously platform-side (a D1 error, an
      // uncaught scanner/orchestrator exception), never counted as a target
      // failure (§23). Still write a minimal failure record so scan history
      // stays accurate.
      await persistFailedScanRecord(
        db,
        domain,
        scanId,
        registry.registryVersionId,
        registry.rulesetVersionId,
      );
      await handleScanFailure(db, domain, scanId, now, "platform", failureThreshold);
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
