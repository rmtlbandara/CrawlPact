import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { BatchItem } from "drizzle-orm/batch";
import type { SafeFetchResult } from "@crawlpact/scanner";
import { buildHtmlMetaEvidence } from "@crawlpact/scanner";
import { selectFindingsForPersistence } from "@crawlpact/policy";
import type { AuditResult } from "./run-audit";

function nowIso(): string {
  return new Date().toISOString();
}

/** Unkeyed SHA-256 hex digest — used only for change-detection/evidence
 * hashing of already-public page content, never for anything sensitive (see
 * hashIp/hashShareToken for the HMAC pattern used where secrecy matters). */
async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Persists a completed audit (SRS §23, §32). Historical scan interpretation
 * is immutable once written — this function only ever inserts, never
 * updates a `scans` row after the fact (a re-scan is a new row, per
 * FR-REG-007's "historical scans retain the registry version originally
 * used").
 *
 * Phase 11 (Database, Storage, Retention and Performance Hardening): every
 * insert below is collected into one statement array and sent as a single
 * `db.batch()` call rather than individually `await`-ed — this was
 * previously the largest uncosted CPU/latency driver in the scan path
 * (docs/operations/SCAN_CAPACITY_BUDGET.md §1.5/§4.1: ~30-35 statements
 * typical, ~76 worst case, each its own D1 round trip). `db.batch()` is D1's
 * own atomic multi-statement primitive (drizzle-orm/d1) — either every
 * statement in the array commits or none do, which also satisfies this
 * phase's atomicity requirement ("a scan must not be marked complete while
 * its required result rows are absent") for free: there is no longer a
 * window where the `scans` row exists but its resource/finding rows don't,
 * because they're the same D1 transaction, not a sequence of separate ones.
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
  const fetchedAt = nowIso();

  const { kept: findingsToPersist, omittedCount: findingsOmittedCount } =
    selectFindingsForPersistence(result.findings);

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
  // Determined ahead of building statements: scan_crawler_results.source_resource_id
  // needs to know whether a robots_txt resource row will exist in this same
  // batch, without being able to read back an autoincrement id (nothing here
  // is autoincrement — ids are deterministic strings — so this is safe to
  // precompute).
  for (const entry of resourceEntries) {
    if (entry.type === "robots_txt" && entry.outcome.attempted && entry.outcome.fetch) {
      robotsTxtResourceId = `${params.scanId}_robots_txt`;
    }
  }

  const statements: BatchItem<"sqlite">[] = [];

  statements.push(
    db.insert(schema.scans).values({
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
      findingsOmittedCount,
      errorCategory:
        result.status === "target_unavailable" || result.status === "incomplete"
          ? result.scanSignals.robotsTxt.fetch && !result.scanSignals.robotsTxt.fetch.ok
            ? result.scanSignals.robotsTxt.fetch.errorCategory
            : "unknown"
          : null,
      startedAt,
      completedAt: nowIso(),
    }),
  );

  for (const entry of resourceEntries) {
    if (!entry.outcome.attempted) continue;
    const fetchResult = entry.outcome.fetch;
    const resourceId = `${params.scanId}_${entry.type}`;

    // `fetch === null` means the safe-fetch chokepoint refused the request
    // outright (e.g. target failed validation) — nothing was attempted at
    // the network layer, so there is no resource row to write.
    if (!fetchResult) continue;

    if (fetchResult.ok) {
      // Phase 11 (RISK-007): html_meta and sitemap previously stored up to
      // 100,000 bytes of the raw fetched body per scan even though nothing
      // ever reads more than a handful of already-extracted fields back out
      // of either (measured production averages: html_meta 53,554
      // bytes/row, sitemap 20,891 bytes/row — the two largest columns in
      // `scan_resources` by a wide margin). Both now store a minimised
      // evidence blob instead of the raw body: html_meta via
      // buildHtmlMetaEvidence, sitemap via the already-computed
      // SitemapValidation result (nothing downstream has ever read
      // sitemap's raw snapshotText — validateSitemap's parsed output is the
      // entire evidentiary value). Every other resource type is unaffected
      // and keeps its existing bounded raw-text capture, since their
      // report-layer readers (parseRsl, parseLlmsTxt, parseContentSignals,
      // parseXRobotsTag, the robots.txt evaluator) parse the real
      // persisted text, not just a handful of pre-extracted fields.
      const snapshotText =
        entry.type === "html_meta"
          ? JSON.stringify(buildHtmlMetaEvidence(fetchResult.body))
          : entry.type === "sitemap"
            ? JSON.stringify(result.scanSignals.sitemap.parsed)
            : fetchResult.body.slice(0, 100_000);
      // Phase 11 (resource hashing): every fetched resource is hashed off
      // the real, complete fetched body — not the (possibly truncated)
      // stored snapshotText — so two scans that fetched byte-identical
      // content always hash identically regardless of any storage-side
      // truncation. This phase only *populates* the hash for future
      // change-detection use (e.g. skipping re-analysis of an unchanged
      // resource, or cheap scan_diffs comparisons); it deliberately does not
      // yet implement cross-scan deduplication of snapshotText itself — see
      // docs/data/PHASE_11_RESOURCE_HASH_AND_DEDUPLICATION_POLICY.md for why
      // that's a separate, larger decision this phase defers.
      const resourceHash = await sha256Hex(fetchResult.body);
      statements.push(
        db.insert(schema.scanResources).values({
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
          resourceHash,
          snapshotText,
          fetchedAt,
        }),
      );
    } else {
      statements.push(
        db.insert(schema.scanResources).values({
          id: resourceId,
          scanId: params.scanId,
          resourceType: entry.type as (typeof schema.scanResources.$inferInsert)["resourceType"],
          requestedUrl: fetchResult.requestedUrl,
          finalUrl: fetchResult.finalUrl,
          errorCategory: fetchResult.errorCategory,
          redirectCount: fetchResult.redirectCount,
          durationMs: fetchResult.durationMs,
          fetchedAt,
        }),
      );
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
    statements.push(
      db.insert(schema.scanResources).values({
        id: `${params.scanId}_content_signals`,
        scanId: params.scanId,
        resourceType: "content_signals",
        requestedUrl: homepageFetchResult.requestedUrl,
        finalUrl: homepageFetchResult.finalUrl,
        statusCode: homepageFetchResult.statusCode,
        snapshotText: result.scanSignals.contentSignals?.raw ?? "",
        fetchedAt,
      }),
    );
    statements.push(
      db.insert(schema.scanResources).values({
        id: `${params.scanId}_http_headers`,
        scanId: params.scanId,
        resourceType: "http_headers",
        requestedUrl: homepageFetchResult.requestedUrl,
        finalUrl: homepageFetchResult.finalUrl,
        statusCode: homepageFetchResult.statusCode,
        snapshotText: JSON.stringify(result.scanSignals.xRobotsTag),
        fetchedAt,
      }),
    );
  }

  for (const evaluation of result.crawlerEvaluations) {
    statements.push(
      db.insert(schema.scanCrawlerResults).values({
        id: `${params.scanId}_${evaluation.crawlerId}`,
        scanId: params.scanId,
        crawlerId: evaluation.crawlerId,
        result: evaluation.result,
        matchedRule: evaluation.matchedRule,
        matchedLineNumber: evaluation.matchedLineNumber,
        evaluationExplanation: null,
        sourceResourceId: robotsTxtResourceId,
      }),
    );
  }

  for (const [index, finding] of findingsToPersist.entries()) {
    statements.push(
      db.insert(schema.findings).values({
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
      }),
    );
  }

  // `db.batch` requires a statically non-empty array; `statements[0]` is
  // always the scans insert above, so this is never actually empty at
  // runtime — the `!` only satisfies the type, matching the guarantee.
  await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}
