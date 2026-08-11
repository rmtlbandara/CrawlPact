import { eq, inArray } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { CrawlerPurpose, LifecycleStatus } from "@crawlpact/registry";

/**
 * Phase 15: the canonical, immutable per-crawler snapshot shape stored in
 * `registry_version_entries.snapshot` at release-creation time.
 *
 * Deliberately excludes mutable admin metadata (`notes`, `approvedByUserId`,
 * `createdAt`, `updatedAt`) that isn't needed to reproduce an evaluation or
 * render a historical result — see `docs/registry/PHASE_15_REGISTRY_PROVENANCE_DATA_MODEL.md`.
 */
export type CanonicalCrawlerSnapshot = {
  schemaVersion: 2;
  id: string;
  operatorId: string;
  operatorName: string;
  name: string;
  userAgentToken: string;
  alternativeTokens: string[];
  purpose: CrawlerPurpose;
  description: string;
  officialSourceUrl: string;
  lifecycleStatus: LifecycleStatus;
  replacementCrawlerId: string | null;
  publishedIpInfo: unknown | null;
  firstVerifiedAt: string | null;
  lastVerifiedAt: string | null;
};

/** The raw shape a pre-Phase-15 (schema v1) snapshot was written as: a
 * direct `JSON.stringify()` of the live `crawlers` row, including fields
 * schema v2 deliberately drops and lacking `operatorName`. */
type LegacyCrawlerSnapshotV1 = {
  id: string;
  operatorId: string;
  name: string;
  userAgentToken: string;
  alternativeTokens: string | null;
  purpose: CrawlerPurpose;
  description: string;
  officialSourceUrl: string;
  lifecycleStatus: LifecycleStatus;
  replacementCrawlerId: string | null;
  publishedIpInfo: string | null;
  firstVerifiedAt: string | null;
  lastVerifiedAt: string | null;
};

function parseAlternativeTokens(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Builds the canonical schema-v2 snapshot for a live crawler row at
 * release-creation time. `operatorName` is captured now (not resolved by a
 * later live join) so the snapshot remains self-contained even if the
 * operator is later renamed.
 */
export function buildCanonicalSnapshot(
  crawler: typeof schema.crawlers.$inferSelect,
  operatorName: string,
): CanonicalCrawlerSnapshot {
  return {
    schemaVersion: 2,
    id: crawler.id,
    operatorId: crawler.operatorId,
    operatorName,
    name: crawler.name,
    userAgentToken: crawler.userAgentToken,
    alternativeTokens: parseAlternativeTokens(crawler.alternativeTokens).sort(),
    purpose: crawler.purpose,
    description: crawler.description,
    officialSourceUrl: crawler.officialSourceUrl,
    lifecycleStatus: crawler.lifecycleStatus,
    replacementCrawlerId: crawler.replacementCrawlerId,
    publishedIpInfo: crawler.publishedIpInfo ? JSON.parse(crawler.publishedIpInfo) : null,
    firstVerifiedAt: crawler.firstVerifiedAt,
    lastVerifiedAt: crawler.lastVerifiedAt,
  };
}

function isSchemaV2(value: unknown): value is CanonicalCrawlerSnapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { schemaVersion?: number }).schemaVersion === 2
  );
}

/**
 * Parses one `registry_version_entries.snapshot` JSON string into the
 * canonical shape, transparently upgrading legacy (schema v1, pre-Phase-15)
 * rows in memory — the stored row itself is never rewritten (see migration
 * 0034's comment). `operatorNameFallback` is required for v1 rows only,
 * since they didn't capture the operator's name at snapshot time.
 */
export function parseCrawlerSnapshot(
  raw: string,
  operatorNameFallback: (operatorId: string) => string | undefined,
): CanonicalCrawlerSnapshot {
  const parsed: unknown = JSON.parse(raw);
  if (isSchemaV2(parsed)) return parsed;

  const legacy = parsed as LegacyCrawlerSnapshotV1;
  return {
    schemaVersion: 2,
    id: legacy.id,
    operatorId: legacy.operatorId,
    operatorName: operatorNameFallback(legacy.operatorId) ?? "Unknown operator",
    name: legacy.name,
    userAgentToken: legacy.userAgentToken,
    alternativeTokens: parseAlternativeTokens(legacy.alternativeTokens).sort(),
    purpose: legacy.purpose,
    description: legacy.description,
    officialSourceUrl: legacy.officialSourceUrl,
    lifecycleStatus: legacy.lifecycleStatus,
    replacementCrawlerId: legacy.replacementCrawlerId,
    publishedIpInfo: legacy.publishedIpInfo ? JSON.parse(legacy.publishedIpInfo) : null,
    firstVerifiedAt: legacy.firstVerifiedAt,
    lastVerifiedAt: legacy.lastVerifiedAt,
  };
}

/**
 * Loads every crawler snapshot recorded in a given (immutable) registry
 * release, keyed by crawler ID. This is the single authoritative read path
 * for both live evaluation (`getActiveRegistry`) and historical rendering
 * (`getScanReport`, domain-timeline) — both must resolve crawler identity
 * from the frozen release a scan actually used, never from the live
 * mutable `crawlers` table.
 */
export async function getRegistryVersionSnapshotMap(
  db: Database,
  registryVersionId: string,
): Promise<Map<string, CanonicalCrawlerSnapshot>> {
  const entries = await db
    .select({
      crawlerId: schema.registryVersionEntries.crawlerId,
      snapshot: schema.registryVersionEntries.snapshot,
    })
    .from(schema.registryVersionEntries)
    .where(eq(schema.registryVersionEntries.registryVersionId, registryVersionId));

  if (entries.length === 0) return new Map();

  // v1 snapshots need a one-time batched operator-name lookup; v2 snapshots
  // already carry operatorName and never need this.
  const legacyOperatorIds = new Set<string>();
  for (const entry of entries) {
    const parsed: unknown = JSON.parse(entry.snapshot);
    if (!isSchemaV2(parsed) && typeof (parsed as { operatorId?: string }).operatorId === "string") {
      legacyOperatorIds.add((parsed as { operatorId: string }).operatorId);
    }
  }
  const operatorNames = new Map<string, string>();
  if (legacyOperatorIds.size > 0) {
    const rows = await db
      .select({ id: schema.crawlerOperators.id, name: schema.crawlerOperators.name })
      .from(schema.crawlerOperators)
      .where(inArray(schema.crawlerOperators.id, [...legacyOperatorIds]));
    for (const row of rows) operatorNames.set(row.id, row.name);
  }

  const map = new Map<string, CanonicalCrawlerSnapshot>();
  for (const entry of entries) {
    map.set(
      entry.crawlerId,
      parseCrawlerSnapshot(entry.snapshot, (operatorId) => operatorNames.get(operatorId)),
    );
  }
  return map;
}
