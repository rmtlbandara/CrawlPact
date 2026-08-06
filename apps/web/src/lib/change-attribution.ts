import { eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

/**
 * Deterministic change-origin attribution (Phase 8). See
 * docs/product/DOMAIN_CHANGE_ATTRIBUTION_MODEL.md for the full rationale —
 * this file and that document must stay in sync, following the same
 * convention already established for policy-summary.ts.
 */

export const ATTRIBUTION_MODEL_VERSION = "1";

export type ChangeOrigin =
  "website_policy" | "registry_driven" | "mixed" | "operational" | "uncertain" | "baseline";

export type OperationalReason = "previous_scan_incomplete" | "current_scan_incomplete";
export type UncertainReason = "evidence_unavailable";

export type AttributionResult =
  | { origin: "baseline" }
  | { origin: "operational"; reason: OperationalReason }
  | { origin: "uncertain"; reason: UncertainReason }
  | {
      origin: "website_policy" | "registry_driven" | "mixed";
      websiteChanged: boolean;
      registryChanged: boolean;
      comparedResourceTypes: ComparableResourceType[];
      changedResourceTypes: ComparableResourceType[];
    }
  | { origin: "no_change" };

const COMPLETE_STATUSES = new Set(["completed", "completed_with_warnings"]);

/** `sitemap` is excluded — it does not feed crawler-policy evaluation. */
export const COMPARABLE_RESOURCE_TYPES = [
  "robots_txt",
  "llms_txt",
  "llms_full_txt",
  "rsl",
  "content_signals",
  "html_meta",
  "http_headers",
] as const;
export type ComparableResourceType = (typeof COMPARABLE_RESOURCE_TYPES)[number];

type ScanRow = typeof schema.scans.$inferSelect;

/**
 * Compares two scans on the same domain and returns a deterministic origin
 * classification. `previousScanId === null` (no prior scan at all) must be
 * handled by the caller as `baseline` before calling this — this function
 * always expects two real scan ids.
 */
export async function computeChangeOrigin(
  db: Database,
  previousScanId: string,
  currentScanId: string,
): Promise<AttributionResult> {
  const [previousScan, currentScan] = await Promise.all([
    getScanRow(db, previousScanId),
    getScanRow(db, currentScanId),
  ]);

  if (!previousScan || !COMPLETE_STATUSES.has(previousScan.status)) {
    return { origin: "operational", reason: "previous_scan_incomplete" };
  }
  if (!currentScan || !COMPLETE_STATUSES.has(currentScan.status)) {
    return { origin: "operational", reason: "current_scan_incomplete" };
  }

  const [previousResources, currentResources] = await Promise.all([
    getComparableResources(db, previousScanId),
    getComparableResources(db, currentScanId),
  ]);

  const comparedResourceTypes = COMPARABLE_RESOURCE_TYPES.filter(
    (type) => previousResources.has(type) && currentResources.has(type),
  );

  if (comparedResourceTypes.length === 0) {
    return { origin: "uncertain", reason: "evidence_unavailable" };
  }

  const changedResourceTypes = comparedResourceTypes.filter(
    (type) => previousResources.get(type) !== currentResources.get(type),
  );
  const websiteChanged = changedResourceTypes.length > 0;
  const registryChanged = previousScan.registryVersionId !== currentScan.registryVersionId;

  if (!websiteChanged && !registryChanged) {
    return { origin: "no_change" };
  }

  const origin =
    websiteChanged && registryChanged
      ? "mixed"
      : websiteChanged
        ? "website_policy"
        : "registry_driven";

  return {
    origin,
    websiteChanged,
    registryChanged,
    comparedResourceTypes,
    changedResourceTypes,
  };
}

async function getScanRow(db: Database, scanId: string): Promise<ScanRow | null> {
  const [row] = await db.select().from(schema.scans).where(eq(schema.scans.id, scanId)).limit(1);
  return row ?? null;
}

async function getComparableResources(
  db: Database,
  scanId: string,
): Promise<Map<ComparableResourceType, string | null>> {
  const rows = await db
    .select({
      resourceType: schema.scanResources.resourceType,
      resourceHash: schema.scanResources.resourceHash,
    })
    .from(schema.scanResources)
    .where(eq(schema.scanResources.scanId, scanId));

  const comparable = new Set<string>(COMPARABLE_RESOURCE_TYPES);
  const map = new Map<ComparableResourceType, string | null>();
  for (const row of rows) {
    if (comparable.has(row.resourceType)) {
      map.set(row.resourceType as ComparableResourceType, row.resourceHash);
    }
  }
  return map;
}
