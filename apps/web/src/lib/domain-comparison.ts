import { eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { computePolicySummary } from "./policy-summary";
import { getScanReport } from "./get-scan-report";
import { COMPARABLE_RESOURCE_TYPES, type ComparableResourceType } from "./change-attribution";
import { classifyFindingLifecycle } from "./finding-lifecycle";

/**
 * Safe before/after comparison between two scans on the same domain (Phase
 * 8). See docs/product/DOMAIN_COMPARISON_MODEL.md. Ownership of both scan
 * IDs must already be verified by the caller (via the owning domain) before
 * this function is called — it never trusts a scan ID from a request alone.
 */

const COMPLETE_STATUSES = new Set(["completed", "completed_with_warnings"]);

export type ResourceComparison = {
  resourceType: ComparableResourceType;
  previous: { snapshotText: string | null; truncated: boolean; fetchedAt: string } | null;
  current: { snapshotText: string | null; truncated: boolean; fetchedAt: string } | null;
  changed: boolean;
};

export type ScanComparisonResult =
  | { compatible: false; reason: string }
  | {
      compatible: true;
      previousScanId: string;
      currentScanId: string;
      resources: ResourceComparison[];
      crawlerChanges: { crawlerId: string; from: string; to: string }[];
      findingLifecycle: Awaited<ReturnType<typeof classifyFindingLifecycle>>;
      previousRegistryVersion: string | null;
      currentRegistryVersion: string | null;
      previousSummary: ReturnType<typeof computePolicySummary> | null;
      currentSummary: ReturnType<typeof computePolicySummary> | null;
    };

export async function compareScans(
  db: Database,
  domainId: string,
  previousScanId: string,
  currentScanId: string,
): Promise<ScanComparisonResult> {
  if (previousScanId === currentScanId) {
    return { compatible: false, reason: "The same scan cannot be compared to itself." };
  }

  const [previousScan] = await db
    .select()
    .from(schema.scans)
    .where(eq(schema.scans.id, previousScanId))
    .limit(1);
  const [currentScan] = await db
    .select()
    .from(schema.scans)
    .where(eq(schema.scans.id, currentScanId))
    .limit(1);

  if (!previousScan || previousScan.domainId !== domainId) {
    return { compatible: false, reason: "The previous scan could not be found for this domain." };
  }
  if (!currentScan || currentScan.domainId !== domainId) {
    return { compatible: false, reason: "The current scan could not be found for this domain." };
  }
  if (!COMPLETE_STATUSES.has(previousScan.status) || !COMPLETE_STATUSES.has(currentScan.status)) {
    return {
      compatible: false,
      reason:
        "These scans were created from materially different or incomplete evidence, so CrawlPact cannot provide a direct comparison.",
    };
  }

  const [previousResources, currentResources] = await Promise.all([
    db.select().from(schema.scanResources).where(eq(schema.scanResources.scanId, previousScanId)),
    db.select().from(schema.scanResources).where(eq(schema.scanResources.scanId, currentScanId)),
  ]);

  const resources: ResourceComparison[] = COMPARABLE_RESOURCE_TYPES.map((resourceType) => {
    const previous = previousResources.find((r) => r.resourceType === resourceType);
    const current = currentResources.find((r) => r.resourceType === resourceType);
    return {
      resourceType,
      previous: previous
        ? {
            snapshotText: previous.snapshotText,
            truncated: previous.truncated,
            fetchedAt: previous.fetchedAt,
          }
        : null,
      current: current
        ? {
            snapshotText: current.snapshotText,
            truncated: current.truncated,
            fetchedAt: current.fetchedAt,
          }
        : null,
      changed: Boolean(previous && current && previous.resourceHash !== current.resourceHash),
    };
  });

  if (resources.every((r) => r.previous === null || r.current === null)) {
    return {
      compatible: false,
      reason:
        "These scans were created from materially different or incomplete evidence, so CrawlPact cannot provide a direct comparison.",
    };
  }

  const [previousCrawlerResults, currentCrawlerResults] = await Promise.all([
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
  ]);
  const previousByCrawler = new Map(previousCrawlerResults.map((r) => [r.crawlerId, r.result]));
  const crawlerChanges = currentCrawlerResults
    .filter(
      (c) => previousByCrawler.has(c.crawlerId) && previousByCrawler.get(c.crawlerId) !== c.result,
    )
    .map((c) => ({
      crawlerId: c.crawlerId,
      from: previousByCrawler.get(c.crawlerId)!,
      to: c.result,
    }));

  const findingLifecycle = await classifyFindingLifecycle(db, {
    previousScanId,
    currentScanId,
    currentScanComparable: true,
  });

  const [previousReport, currentReport] = await Promise.all([
    getScanReport(db, previousScanId),
    getScanReport(db, currentScanId),
  ]);

  return {
    compatible: true,
    previousScanId,
    currentScanId,
    resources,
    crawlerChanges,
    findingLifecycle,
    previousRegistryVersion: previousReport?.registryVersion ?? null,
    currentRegistryVersion: currentReport?.registryVersion ?? null,
    previousSummary: previousReport ? computePolicySummary(previousReport) : null,
    currentSummary: currentReport ? computePolicySummary(currentReport) : null,
  };
}
