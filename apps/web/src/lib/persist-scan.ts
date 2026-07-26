import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { SafeFetchResult } from "@crawlpact/scanner";
import type { AuditResult } from "./run-audit";

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Persists a completed audit (SRS §23, §32). Historical scan interpretation
 * is immutable once written — this function only ever inserts, never
 * updates a `scans` row after the fact (a re-scan is a new row, per
 * FR-REG-007's "historical scans retain the registry version originally
 * used").
 */
export async function persistScan(
  db: Database,
  params: {
    scanId: string;
    targetInput: string;
    preset: string;
    registryVersionId: string;
    rulesetVersionId: string;
    domainId?: string | null;
    triggeredBy?: "anonymous" | "manual" | "scheduled" | "admin";
    triggeredByUserId?: string | null;
  },
  result: AuditResult,
): Promise<void> {
  const startedAt = nowIso();

  await db.insert(schema.scans).values({
    id: params.scanId,
    domainId: params.domainId ?? null,
    triggeredBy: params.triggeredBy ?? "anonymous",
    triggeredByUserId: params.triggeredByUserId ?? null,
    targetInput: params.targetInput,
    canonicalOrigin: result.canonicalOrigin,
    status: result.status,
    preset: params.preset,
    registryVersionId: params.registryVersionId,
    rulesetVersionId: params.rulesetVersionId,
    score: result.score.state === "scored" ? result.score.value : null,
    scoreState: result.score.state,
    scoreBreakdown:
      result.score.state === "scored" ? JSON.stringify(result.score.categoryBreakdown) : null,
    externalRequestCount: result.externalRequestCount,
    recommendedAdditions: JSON.stringify(result.recommendation.proposedAdditions),
    errorCategory:
      result.status === "target_unavailable" || result.status === "incomplete"
        ? result.scanSignals.robotsTxt.fetch && !result.scanSignals.robotsTxt.fetch.ok
          ? result.scanSignals.robotsTxt.fetch.errorCategory
          : "unknown"
        : null,
    startedAt,
    completedAt: nowIso(),
  });

  const resourceEntries: Array<{
    type: string;
    outcome: { attempted: boolean; fetch: SafeFetchResult | null };
  }> = [
    { type: "robots_txt", outcome: result.scanSignals.robotsTxt },
    { type: "llms_txt", outcome: result.scanSignals.llmsTxt },
    { type: "llms_full_txt", outcome: result.scanSignals.llmsFullTxt },
    { type: "sitemap", outcome: result.scanSignals.sitemap },
    { type: "html_meta", outcome: result.scanSignals.homepage },
    { type: "rsl", outcome: result.scanSignals.rsl },
  ];

  let robotsTxtResourceId: string | null = null;

  for (const entry of resourceEntries) {
    if (!entry.outcome.attempted) continue;
    const fetchResult = entry.outcome.fetch;
    const resourceId = `${params.scanId}_${entry.type}`;

    // `fetch === null` means the safe-fetch chokepoint refused the request
    // outright (e.g. target failed validation) — nothing was attempted at
    // the network layer, so there is no resource row to write.
    if (!fetchResult) continue;

    if (entry.type === "robots_txt") robotsTxtResourceId = resourceId;

    if (fetchResult.ok) {
      await db.insert(schema.scanResources).values({
        id: resourceId,
        scanId: params.scanId,
        resourceType: entry.type as (typeof schema.scanResources.$inferInsert)["resourceType"],
        requestedUrl: fetchResult.requestedUrl,
        finalUrl: fetchResult.finalUrl,
        statusCode: fetchResult.statusCode,
        contentType: fetchResult.contentType,
        contentSizeBytes: fetchResult.contentSizeBytes,
        redirectCount: fetchResult.redirectCount,
        durationMs: fetchResult.durationMs,
        truncated: fetchResult.truncated,
        snapshotText: fetchResult.body.slice(0, 100_000),
        fetchedAt: nowIso(),
      });
    } else {
      await db.insert(schema.scanResources).values({
        id: resourceId,
        scanId: params.scanId,
        resourceType: entry.type as (typeof schema.scanResources.$inferInsert)["resourceType"],
        requestedUrl: fetchResult.requestedUrl,
        finalUrl: fetchResult.finalUrl,
        errorCategory: fetchResult.errorCategory,
        redirectCount: fetchResult.redirectCount,
        durationMs: fetchResult.durationMs,
        fetchedAt: nowIso(),
      });
    }
  }

  // Content Signals and X-Robots-Tag are read from the homepage response's
  // headers, not their own fetch — so they ride on the homepage fetch's
  // outcome rather than having a `ResourceOutcome` of their own. Persisting
  // them (rather than discarding them after conflict-detection, as before)
  // is what lets the report layer show an honest, scoped view of each
  // (SRS §30, free tools) instead of re-deriving nothing.
  const homepageFetchResult = result.scanSignals.homepage.fetch;
  if (homepageFetchResult?.ok) {
    await db.insert(schema.scanResources).values({
      id: `${params.scanId}_content_signals`,
      scanId: params.scanId,
      resourceType: "content_signals",
      requestedUrl: homepageFetchResult.requestedUrl,
      finalUrl: homepageFetchResult.finalUrl,
      statusCode: homepageFetchResult.statusCode,
      snapshotText: result.scanSignals.contentSignals?.raw ?? "",
      fetchedAt: nowIso(),
    });
    await db.insert(schema.scanResources).values({
      id: `${params.scanId}_http_headers`,
      scanId: params.scanId,
      resourceType: "http_headers",
      requestedUrl: homepageFetchResult.requestedUrl,
      finalUrl: homepageFetchResult.finalUrl,
      statusCode: homepageFetchResult.statusCode,
      snapshotText: JSON.stringify(result.scanSignals.xRobotsTag),
      fetchedAt: nowIso(),
    });
  }

  for (const evaluation of result.crawlerEvaluations) {
    await db.insert(schema.scanCrawlerResults).values({
      id: `${params.scanId}_${evaluation.crawlerId}`,
      scanId: params.scanId,
      crawlerId: evaluation.crawlerId,
      result: evaluation.result,
      matchedRule: evaluation.matchedRule,
      matchedLineNumber: evaluation.matchedLineNumber,
      evaluationExplanation: null,
      sourceResourceId: robotsTxtResourceId,
    });
  }

  for (const [index, finding] of result.findings.entries()) {
    await db.insert(schema.findings).values({
      id: `${params.scanId}_finding_${index}`,
      scanId: params.scanId,
      findingCode: finding.code,
      severity: finding.severity,
      category: finding.category,
      title: finding.title,
      summary: finding.summary,
      evidence: JSON.stringify({
        evidenceSummary: finding.evidenceSummary,
        fingerprint: finding.fingerprint,
      }),
      affectedCrawlerId: finding.affectedCrawlerId,
      businessImpact: finding.whyItMatters,
      recommendedAction: finding.recommendedAction,
      confidence: finding.confidence,
      sourceUrl: finding.sourceUrl,
      rulesetVersionId: params.rulesetVersionId,
      createdAt: nowIso(),
    });
  }
}
