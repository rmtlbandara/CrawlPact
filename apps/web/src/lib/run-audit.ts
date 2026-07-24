import { runScan } from "@crawlpact/scanner";
import type { RunScanOptions } from "@crawlpact/scanner";
import { evaluateRobots } from "@crawlpact/robots";
import {
  buildFindings,
  buildRobotsDiff,
  computePolicyHealthScore,
  detectConflicts,
  fullProposedText,
  generateRecommendations,
} from "@crawlpact/policy";
import type {
  CrawlerEvaluation,
  PolicyEvaluationInput,
  SignalBundle,
  PolicyPreset,
} from "@crawlpact/policy";
import type { CrawlerPurpose, LifecycleStatus } from "@crawlpact/registry";

export type RegistryCrawlerRow = {
  id: string;
  name: string;
  operatorName: string;
  userAgentToken: string;
  purpose: CrawlerPurpose;
  lifecycleStatus: LifecycleStatus;
  replacementCrawlerId: string | null;
};

export type AuditResult = {
  status: "completed" | "completed_with_warnings" | "incomplete" | "target_unavailable";
  canonicalOrigin: string;
  crawlerEvaluations: CrawlerEvaluation[];
  conflicts: ReturnType<typeof detectConflicts>;
  findings: ReturnType<typeof buildFindings>;
  score: ReturnType<typeof computePolicyHealthScore>;
  recommendation: { proposedAdditions: string[]; warnings: string[] };
  diff: ReturnType<typeof buildRobotsDiff>;
  originalRobotsText: string | null;
  proposedRobotsText: string;
  externalRequestCount: number;
  scanSignals: Awaited<ReturnType<typeof runScan>>;
};

/**
 * The single place that ties the scanner (fetch+parse), the registry
 * (crawler metadata), and the policy engine (preset/conflict/findings/
 * score/recommendations) together into one audit result. Deliberately
 * framework-agnostic (no D1 access here) so it stays unit-testable without
 * mocking Astro or Cloudflare — the caller (the API route) is responsible
 * for persistence.
 */
export async function runAudit(
  canonicalOrigin: string,
  preset: PolicyPreset,
  registryCrawlers: RegistryCrawlerRow[],
  rulesetVersion: string,
  scanOptions: RunScanOptions = {},
): Promise<AuditResult> {
  const scanSignals = await runScan(canonicalOrigin, scanOptions);

  const robotsFetchSucceeded = scanSignals.robotsTxt.fetch?.ok === true;
  const parsedRobots = scanSignals.robotsTxt.parsed;

  const crawlerEvaluations: CrawlerEvaluation[] = registryCrawlers.map((crawler) => {
    if (!parsedRobots) {
      return {
        crawlerId: crawler.id,
        crawlerName: crawler.name,
        operatorName: crawler.operatorName,
        userAgentToken: crawler.userAgentToken,
        purpose: crawler.purpose,
        lifecycleStatus: crawler.lifecycleStatus,
        replacementCrawlerId: crawler.replacementCrawlerId,
        result: "resource_unavailable",
        matchedRule: null,
        matchedLineNumber: null,
      };
    }
    const trace = evaluateRobots(parsedRobots, crawler.userAgentToken, "/");
    return {
      crawlerId: crawler.id,
      crawlerName: crawler.name,
      operatorName: crawler.operatorName,
      userAgentToken: crawler.userAgentToken,
      purpose: crawler.purpose,
      lifecycleStatus: crawler.lifecycleStatus,
      replacementCrawlerId: crawler.replacementCrawlerId,
      result: trace.result,
      matchedRule: trace.matchedRule
        ? `${trace.matchedRule.type} ${trace.matchedRule.pattern}`
        : null,
      matchedLineNumber: trace.lineNumber,
    };
  });

  const signals: SignalBundle = {
    robots: {
      fetched: robotsFetchSucceeded,
      statusCode: scanSignals.robotsTxt.fetch?.ok ? scanSignals.robotsTxt.fetch.statusCode : null,
      issueCodes: parsedRobots?.issues.map((i) => i.code) ?? [],
      hasDuplicateGroups: parsedRobots?.issues.some((i) => i.code === "DUPLICATE_GROUP") ?? false,
      hasBroadWildcardBlock:
        parsedRobots?.issues.some((i) => i.code === "BROAD_WILDCARD_BLOCK") ?? false,
    },
    contentSignals: scanSignals.contentSignals,
    rsl: scanSignals.rsl.parsed,
    html: scanSignals.homepage.parsed,
    sitemap: scanSignals.sitemap.parsed,
    xRobotsTag: scanSignals.xRobotsTag,
  };

  const evaluationInput: PolicyEvaluationInput = {
    preset,
    crawlerEvaluations,
    signals,
    rulesetVersion,
  };

  const conflicts = detectConflicts(evaluationInput);
  const findings = buildFindings(conflicts, rulesetVersion);
  const score = computePolicyHealthScore(evaluationInput, conflicts, robotsFetchSucceeded);
  const recommendation = generateRecommendations(conflicts, crawlerEvaluations);
  const originalRobotsText = scanSignals.robotsTxt.fetch?.ok
    ? scanSignals.robotsTxt.fetch.body
    : null;
  const diff = buildRobotsDiff(originalRobotsText ?? "", recommendation.proposedAdditions);
  const proposedRobotsText = fullProposedText(
    originalRobotsText ?? "",
    recommendation.proposedAdditions,
  );

  let status: AuditResult["status"];
  if (!scanSignals.robotsTxt.fetch) {
    // The safe-fetch chokepoint refused to even attempt the request (e.g.
    // the target failed validation) — see ADR-0005.
    status = "target_unavailable";
  } else if (!robotsFetchSucceeded) {
    // The request was attempted but did not complete (DNS/timeout/etc.) —
    // the audit still produced a result, just an incomplete one.
    status = "incomplete";
  } else if (findings.some((f) => f.severity === "critical" || f.severity === "high")) {
    status = "completed_with_warnings";
  } else {
    status = "completed";
  }

  return {
    status,
    canonicalOrigin,
    crawlerEvaluations,
    conflicts,
    findings,
    score,
    recommendation,
    diff,
    originalRobotsText,
    proposedRobotsText,
    externalRequestCount: scanSignals.externalRequestCount,
    scanSignals,
  };
}
