import { and, eq, gt, isNull } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { PolicyPreset } from "@crawlpact/policy";
import type { AuditContinuationIntent } from "@crawlpact/core";
import { recordScanOnDomain } from "./domains";
import { getActiveRegistry } from "./registry-data";
import { runAudit } from "./run-audit";
import { persistScan } from "./persist-scan";
import { computeNextScanAt } from "./scan-scheduling";
import { getBlockedTargetPatterns } from "./blocked-targets";
import { getIntConfig } from "./runtime-config";
import { generateTimelineEvent } from "./domain-timeline";

/**
 * Phase 8: the domain saved here is always brand new (just created by the
 * calling route), so this is always a genuine first-ever baseline — never
 * blocks the save/scan outcome on a timeline-write failure, matching the
 * identical rationale in monitoring.ts's safeGenerateTimelineEvent.
 */
async function safeGenerateBaselineEvent(
  db: Database,
  domainId: string,
  scanId: string,
): Promise<void> {
  try {
    await generateTimelineEvent(db, { domainId, previousScanId: null, currentScanId: scanId });
  } catch (error) {
    console.error("Baseline timeline event generation failed", { domainId, scanId, error });
  }
}

/**
 * Secure continuation mechanism preserving anonymous-audit intent through signup/login (Phase
 * 5). See docs/security/PHASE_05_AUDIT_CONVERSION_THREAT_REVIEW.md for the full threat model and
 * docs/product/ANONYMOUS_TO_AUTHENTICATED_BASELINE_POLICY.md for the adopt-vs-rerun decision.
 *
 * Deliberately server-side-record-based (migration 0020, `audit_continuations`), not a
 * client-carried signed payload — this needs an explicit, testable "already consumed" state,
 * which a stateless token cannot provide without a companion DB record anyway.
 */

const CONTINUATION_TTL_MINUTES = 60;

export type IntendedAction = AuditContinuationIntent;

export async function createContinuation(
  db: Database,
  fields: { scanId: string; canonicalOrigin: string; intendedAction: IntendedAction },
): Promise<{ id: string; expiresAt: string }> {
  const id = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CONTINUATION_TTL_MINUTES * 60_000).toISOString();

  await db.insert(schema.auditContinuations).values({
    id,
    scanId: fields.scanId,
    canonicalOrigin: fields.canonicalOrigin,
    intendedAction: fields.intendedAction,
    createdAt: now.toISOString(),
    expiresAt,
  });

  return { id, expiresAt };
}

export type ConsumeContinuationResult =
  | { ok: true; continuation: typeof schema.auditContinuations.$inferSelect }
  | { ok: false; reason: "not_found" | "expired" | "already_consumed" };

/**
 * Atomically marks a continuation as consumed, in the same statement that checks it hasn't
 * already been consumed and hasn't expired — closes the TOCTOU window a separate
 * read-then-write pair would leave open (same discipline as the billing webhook
 * compare-and-swap fix; see docs/status/BILLING_WEBHOOK_RACE_TEST_FLAKE.md for why that
 * distinction matters in practice, not just in theory).
 */
export async function consumeContinuation(
  db: Database,
  continuationId: string,
): Promise<ConsumeContinuationResult> {
  const now = new Date().toISOString();

  const updated = await db
    .update(schema.auditContinuations)
    .set({ consumedAt: now })
    .where(
      and(
        eq(schema.auditContinuations.id, continuationId),
        isNull(schema.auditContinuations.consumedAt),
        gt(schema.auditContinuations.expiresAt, now),
      ),
    )
    .returning();

  if (updated[0]) return { ok: true, continuation: updated[0] };

  // Distinguish "doesn't exist" / "expired" / "already consumed" for accurate, non-leaky
  // error states (section 21's required cases) — a second, read-only lookup after the failed
  // conditional update, not a security-relevant race (the write above already happened
  // atomically; this is purely for choosing which safe message to show).
  const [existing] = await db
    .select()
    .from(schema.auditContinuations)
    .where(eq(schema.auditContinuations.id, continuationId))
    .limit(1);

  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.consumedAt) return { ok: false, reason: "already_consumed" };
  return { ok: false, reason: "expired" };
}

export type BaselineResult =
  | { strategy: "adopted"; scanId: string; scoreValue: number | null; scanStartedAt: string }
  | { strategy: "rerun"; scanId: string; scoreValue: number | null; status: string }
  | { strategy: "failed"; reason: "scan_missing" | "rerun_failed" | "engine_disabled" };

/**
 * Implements docs/product/ANONYMOUS_TO_AUTHENTICATED_BASELINE_POLICY.md exactly: adopt the
 * already-computed anonymous scan when it's fresh/complete/current-registry and no one else has
 * already claimed it (atomic `WHERE domain_id IS NULL` guard); otherwise rerun under the
 * authenticated account using the same runAudit/persistScan path the manual re-scan endpoint
 * already uses — never a second, duplicated evaluation path.
 */
export async function establishBaseline(
  db: Database,
  params: {
    scanId: string;
    domainId: string;
    domainCanonicalOrigin: string;
    domainPreset: string;
    userId: string;
    monitoringFrequency: "none" | "monthly" | "weekly";
    auditEngineEnabled: boolean;
    /** Fired the moment adoption is ruled out and a fresh rerun is about to start — lets callers
     * record the "rerun started" analytics event without this function taking an analytics
     * dependency of its own. Never called on the adopt path. */
    onRerunStarting?: () => void;
  },
): Promise<BaselineResult> {
  const [scan] = await db
    .select()
    .from(schema.scans)
    .where(eq(schema.scans.id, params.scanId))
    .limit(1);

  if (!scan) return { strategy: "failed", reason: "scan_missing" };

  const registry = await getActiveRegistry(db);

  const adoptable =
    (scan.status === "completed" || scan.status === "completed_with_warnings") &&
    registry &&
    scan.registryVersionId === registry.registryVersionId &&
    scan.rulesetVersionId === registry.rulesetVersionId;

  if (adoptable) {
    const claimed = await db
      .update(schema.scans)
      .set({ domainId: params.domainId, triggeredBy: "manual", triggeredByUserId: params.userId })
      .where(and(eq(schema.scans.id, params.scanId), isNull(schema.scans.domainId)))
      .returning();

    if (claimed[0]) {
      await recordScanOnDomain(db, params.domainId, {
        scanId: scan.id,
        score: scan.score,
        nextScanAt: computeNextScanAt(params.monitoringFrequency),
      });
      await safeGenerateBaselineEvent(db, params.domainId, scan.id);
      return {
        strategy: "adopted",
        scanId: scan.id,
        scoreValue: scan.score,
        scanStartedAt: scan.startedAt,
      };
    }
    // Lost the claim race (or already claimed by a prior request) — fall through to rerun,
    // scoped entirely to this account's own domain, revealing nothing about who claimed it.
  }

  if (!params.auditEngineEnabled) return { strategy: "failed", reason: "engine_disabled" };
  if (!registry) return { strategy: "failed", reason: "rerun_failed" };

  params.onRerunStarting?.();

  const blocklist = await getBlockedTargetPatterns(db);
  const totalTimeoutMs = (await getIntConfig(db, "scan_total_timeout_seconds", 30)) * 1000;
  const auditResult = await runAudit(
    params.domainCanonicalOrigin,
    params.domainPreset as PolicyPreset,
    registry.crawlers,
    registry.rulesetVersionId,
    { blocklist, totalTimeoutMs },
  );

  const newScanId = crypto.randomUUID();
  await persistScan(
    db,
    {
      scanId: newScanId,
      targetInput: params.domainCanonicalOrigin,
      preset: params.domainPreset,
      registryVersionId: registry.registryVersionId,
      rulesetVersionId: registry.rulesetVersionId,
      domainId: params.domainId,
      triggeredBy: "manual",
      triggeredByUserId: params.userId,
    },
    auditResult,
  );

  const succeeded =
    auditResult.status === "completed" || auditResult.status === "completed_with_warnings";
  if (!succeeded) return { strategy: "failed", reason: "rerun_failed" };

  await recordScanOnDomain(db, params.domainId, {
    scanId: newScanId,
    score: auditResult.score.state === "scored" ? auditResult.score.value : null,
    nextScanAt: computeNextScanAt(params.monitoringFrequency),
  });
  await safeGenerateBaselineEvent(db, params.domainId, newScanId);

  return {
    strategy: "rerun",
    scanId: newScanId,
    scoreValue: auditResult.score.state === "scored" ? auditResult.score.value : null,
    status: auditResult.status,
  };
}
