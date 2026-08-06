import type { APIRoute } from "astro";
import { ApiError, ok } from "@crawlpact/core";
import type { PolicyPreset } from "@crawlpact/policy";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireSession } from "../../../../lib/auth/require-session";
import {
  countManualScansThisMonth,
  getOwnedDomain,
  recordScanOnDomain,
} from "../../../../lib/domains";
import { getPlan } from "../../../../lib/plan";
import { getActiveRegistry } from "../../../../lib/registry-data";
import { runAudit } from "../../../../lib/run-audit";
import { persistScan } from "../../../../lib/persist-scan";
import { computeNextScanAt } from "../../../../lib/scan-scheduling";
import { trackEvent } from "../../../../lib/analytics";
import { getBlockedTargetPatterns } from "../../../../lib/blocked-targets";
import { getIntConfig } from "../../../../lib/runtime-config";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";
import { releaseScanLock, tryClaimScanLock } from "../../../../lib/scan-lock";
import { generateTimelineEvent } from "../../../../lib/domain-timeline";

export const prerender = false;

/**
 * POST /api/domains/:domainId/scan — manual re-scan (SRS §25). Capped per
 * domain per calendar month by the plan's `manualRescansPerDomainPerMonth`
 * — scheduled monitoring (Step 15) runs independently of this quota.
 */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const domainId = params.domainId;
    if (!domainId) throw new ApiError("VALIDATION_FAILED", "Missing domain id.");

    const domain = await getOwnedDomain(db, user.id, domainId);
    if (!domain) throw new ApiError("NOT_FOUND", "This domain does not exist.");

    const plan = await getPlan(db, user.planId);
    const usedThisMonth = await countManualScansThisMonth(db, domainId);
    if (usedThisMonth >= plan.manualRescansPerDomainPerMonth) {
      throw new ApiError(
        "AUDIT_QUOTA_EXCEEDED",
        `Your plan allows ${plan.manualRescansPerDomainPerMonth} manual re-scan${plan.manualRescansPerDomainPerMonth === 1 ? "" : "s"} of this domain per month.`,
      );
    }

    const auditEngineEnabled = getEnv().AUDIT_ENGINE_ENABLED === "true";
    if (!auditEngineEnabled) {
      throw new ApiError(
        "AUDIT_ENGINE_DISABLED",
        "The audit engine is not enabled in this environment.",
      );
    }

    const registry = await getActiveRegistry(db);
    if (!registry) {
      throw new ApiError(
        "SERVICE_UNAVAILABLE",
        "No active crawler registry release is configured.",
      );
    }

    // Prevents two concurrent rescan requests (or a rescan racing the
    // scheduled sweep) from both running against this domain at once — a
    // real, previously-unguarded gap found during Phase 8 baseline
    // research. The quota check above only reads existing `scans` rows, so
    // a request that loses this claim never actually consumes its monthly
    // allowance. Released in `finally` regardless of outcome.
    const claimed = await tryClaimScanLock(db, domain.id);
    if (!claimed) {
      throw new ApiError(
        "SCAN_ALREADY_RUNNING",
        "A scan is already in progress for this domain. Try again shortly.",
      );
    }

    try {
      await trackEvent(db, "audit_started", { userId: user.id, properties: { trigger: "manual" } });
      await trackEvent(db, "domain_rescan_started", { userId: user.id });

      const blocklist = await getBlockedTargetPatterns(db);
      const totalTimeoutMs = (await getIntConfig(db, "scan_total_timeout_seconds", 30)) * 1000;
      const auditResult = await runAudit(
        domain.canonicalOrigin,
        domain.preset as PolicyPreset,
        registry.crawlers,
        registry.rulesetVersionId,
        { blocklist, totalTimeoutMs },
      );

      const scanId = crypto.randomUUID();
      await persistScan(
        db,
        {
          scanId,
          targetInput: domain.canonicalOrigin,
          preset: domain.preset,
          registryVersionId: registry.registryVersionId,
          rulesetVersionId: registry.rulesetVersionId,
          domainId: domain.id,
          triggeredBy: "manual",
          triggeredByUserId: user.id,
        },
        auditResult,
      );

      // Timeline-event generation must never block the response — see the
      // identical rationale in monitoring.ts's safeGenerateTimelineEvent.
      try {
        await generateTimelineEvent(db, {
          domainId: domain.id,
          previousScanId: domain.lastScanId,
          currentScanId: scanId,
        });
      } catch (error) {
        console.error("Timeline event generation failed", { domainId: domain.id, scanId, error });
      }

      await recordScanOnDomain(db, domain.id, {
        scanId,
        score: auditResult.score.state === "scored" ? auditResult.score.value : null,
        nextScanAt: computeNextScanAt(domain.monitoringFrequency),
      });

      const succeeded =
        auditResult.status === "completed" || auditResult.status === "completed_with_warnings";
      await trackEvent(db, succeeded ? "audit_completed" : "audit_failed", {
        userId: user.id,
        properties: { status: auditResult.status, trigger: "manual" },
      });
      await trackEvent(db, succeeded ? "domain_rescan_completed" : "domain_rescan_failed", {
        userId: user.id,
      });

      return jsonResponse(ok({ scanId, status: auditResult.status }, requestId), 200);
    } finally {
      await releaseScanLock(db, domain.id);
    }
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
