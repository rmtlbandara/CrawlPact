import { eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type {
  AuditReportResponse,
  AuditStateResponse,
  ContentSignalsSignal,
  LlmsTxtSignal,
  RobotsMetaSignal,
  RslSignal,
} from "@crawlpact/core";
import { parseContentSignals, parseHtmlSignals, parseLlmsTxt, parseRsl } from "@crawlpact/scanner";

type ScanResourceRow = typeof schema.scanResources.$inferSelect;

function isFoundStatus(statusCode: number | null): boolean {
  return statusCode !== null && statusCode >= 200 && statusCode < 300;
}

const EMPTY_LLMS_TXT_SIGNAL: LlmsTxtSignal = {
  checked: false,
  found: false,
  hasH1Heading: false,
  linkedResources: [],
  sizeBytes: 0,
  issues: [],
};

function buildLlmsTxtSignal(row: ScanResourceRow | undefined): LlmsTxtSignal {
  if (!row || row.snapshotText === null) return EMPTY_LLMS_TXT_SIGNAL;
  return { checked: true, found: isFoundStatus(row.statusCode), ...parseLlmsTxt(row.snapshotText) };
}

const EMPTY_RSL_SIGNAL: RslSignal = {
  checked: false,
  discovered: false,
  permits: [],
  prohibits: [],
  paymentTerms: [],
  unsupportedElements: [],
  issues: [],
};

function buildRslSignal(row: ScanResourceRow | undefined): RslSignal {
  if (!row || row.snapshotText === null) return EMPTY_RSL_SIGNAL;
  return { checked: true, ...parseRsl(row.snapshotText) };
}

function buildContentSignalsSignal(row: ScanResourceRow | undefined): ContentSignalsSignal {
  if (!row || row.snapshotText === null) {
    return { checked: false, present: false, recognised: {}, unknownFields: {}, raw: null };
  }
  if (row.snapshotText.length === 0) {
    return { checked: true, present: false, recognised: {}, unknownFields: {}, raw: null };
  }
  const parsed = parseContentSignals(row.snapshotText);
  return { checked: true, present: true, ...parsed };
}

function buildRobotsMetaSignal(
  htmlMetaRow: ScanResourceRow | undefined,
  httpHeadersRow: ScanResourceRow | undefined,
): RobotsMetaSignal {
  const xRobotsTag: string[] = httpHeadersRow?.snapshotText
    ? (JSON.parse(httpHeadersRow.snapshotText) as string[])
    : [];
  if (!htmlMetaRow || htmlMetaRow.snapshotText === null) {
    return {
      checked: false,
      metaRobots: null,
      canonicalUrl: null,
      policyReferenceLinks: [],
      xRobotsTag,
    };
  }
  const parsed = parseHtmlSignals(htmlMetaRow.snapshotText);
  return { checked: true, ...parsed, xRobotsTag };
}

/**
 * Reads a persisted scan back out of D1 and assembles it into the
 * `auditReportResponseSchema` / `auditStateResponseSchema` shapes defined in
 * Part 1 (`packages/core`). This is the only place that shape is built from
 * stored rows, so the API route and the report page can never drift from
 * each other.
 */
export async function getScanState(
  db: Database,
  scanId: string,
): Promise<AuditStateResponse | null> {
  const [scan] = await db.select().from(schema.scans).where(eq(schema.scans.id, scanId)).limit(1);
  if (!scan) return null;

  return {
    auditId: scan.id,
    status: scan.status,
    currentStage: null,
    completedStages: [
      "validating_target",
      "checking_reachability",
      "retrieving_policy_resources",
      "parsing_directives",
      "evaluating_crawlers",
      "checking_additional_signals",
      "generating_findings",
      "preparing_report",
    ],
    startedAt: scan.startedAt,
    completedAt: scan.completedAt,
    message: null,
  };
}

export async function getScanReport(
  db: Database,
  scanId: string,
): Promise<AuditReportResponse | null> {
  const [scan] = await db.select().from(schema.scans).where(eq(schema.scans.id, scanId)).limit(1);
  if (!scan) return null;

  const crawlerResults = await db
    .select({
      crawlerId: schema.scanCrawlerResults.crawlerId,
      result: schema.scanCrawlerResults.result,
      matchedRule: schema.scanCrawlerResults.matchedRule,
      matchedLineNumber: schema.scanCrawlerResults.matchedLineNumber,
      crawlerName: schema.crawlers.name,
      operatorName: schema.crawlerOperators.name,
      purpose: schema.crawlers.purpose,
      lastVerifiedAt: schema.crawlers.lastVerifiedAt,
      officialSourceUrl: schema.crawlers.officialSourceUrl,
    })
    .from(schema.scanCrawlerResults)
    .innerJoin(schema.crawlers, eq(schema.scanCrawlerResults.crawlerId, schema.crawlers.id))
    .innerJoin(schema.crawlerOperators, eq(schema.crawlers.operatorId, schema.crawlerOperators.id))
    .where(eq(schema.scanCrawlerResults.scanId, scanId));

  const findingRows = await db
    .select()
    .from(schema.findings)
    .where(eq(schema.findings.scanId, scanId));

  const resourceRows = await db
    .select()
    .from(schema.scanResources)
    .where(eq(schema.scanResources.scanId, scanId));
  const resourceByType = (type: ScanResourceRow["resourceType"]) =>
    resourceRows.find((r) => r.resourceType === type);

  const [registryVersion] = scan.registryVersionId
    ? await db
        .select({ versionLabel: schema.registryVersions.versionLabel })
        .from(schema.registryVersions)
        .where(eq(schema.registryVersions.id, scan.registryVersionId))
        .limit(1)
    : [];

  const [rulesetVersion] = scan.rulesetVersionId
    ? await db
        .select({ versionLabel: schema.rulesetVersions.versionLabel })
        .from(schema.rulesetVersions)
        .where(eq(schema.rulesetVersions.id, scan.rulesetVersionId))
        .limit(1)
    : [];

  return {
    auditId: scan.id,
    domain: scan.canonicalOrigin,
    scanDate: scan.startedAt,
    status: scan.status,
    preset: scan.preset,
    score:
      scan.scoreState === "scored" && scan.score !== null
        ? { state: "scored", value: scan.score, label: scoreLabel(scan.score) }
        : { state: "incomplete" },
    crawlerMatrix: crawlerResults.map((row) => ({
      crawlerId: row.crawlerId,
      crawlerName: row.crawlerName,
      operator: row.operatorName,
      purpose: row.purpose,
      result: row.result,
      matchedRule: row.matchedRule,
      matchedLineNumber: row.matchedLineNumber,
      source: "robots.txt",
      lastVerified: row.lastVerifiedAt,
    })),
    findings: findingRows.map((finding) => {
      const evidence = JSON.parse(finding.evidence) as { evidenceSummary?: string };
      return {
        code: finding.findingCode,
        severity: finding.severity,
        category: finding.category,
        title: finding.title,
        summary: finding.summary,
        whatHappened: finding.summary,
        whyItMatters: finding.businessImpact,
        evidenceSummary: evidence.evidenceSummary ?? finding.summary,
        recommendedAction: finding.recommendedAction,
        limitation: finding.confidence !== "high" ? "This finding's confidence is not high." : null,
        confidence: finding.confidence,
        sourceUrl: finding.sourceUrl,
        rulesetVersion: rulesetVersion?.versionLabel ?? finding.rulesetVersionId,
      };
    }),
    registryVersion: registryVersion?.versionLabel ?? null,
    rulesetVersion: rulesetVersion?.versionLabel ?? null,
    limitations: [
      "This result reflects the website's declared crawler instructions. It does not prove that every crawler will obey them.",
      "Only the homepage and a bounded set of policy resources were inspected — not the entire website.",
    ],
    llmsTxt: buildLlmsTxtSignal(resourceByType("llms_txt")),
    llmsFullTxt: buildLlmsTxtSignal(resourceByType("llms_full_txt")),
    rsl: buildRslSignal(resourceByType("rsl")),
    contentSignals: buildContentSignalsSignal(resourceByType("content_signals")),
    robotsMeta: buildRobotsMetaSignal(resourceByType("html_meta"), resourceByType("http_headers")),
  };
}

function scoreLabel(value: number): string {
  if (value >= 90) return "Strong";
  if (value >= 75) return "Good";
  if (value >= 50) return "Needs attention";
  if (value >= 25) return "Weak";
  return "Critical";
}
