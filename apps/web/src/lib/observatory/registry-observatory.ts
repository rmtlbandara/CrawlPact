import { eq, isNotNull } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { getRegistryVersionSnapshotMap } from "../registry-snapshot";
import { computeSemanticDiff } from "../registry-semantic-diff";

/**
 * Phase 16 Registry Observatory (Layer A) — the mandatory, safe-first public
 * research layer. Every number here is derived exclusively from immutable
 * `registry_versions` / `registry_version_entries` data via
 * `getRegistryVersionSnapshotMap` (Phase 15's sole authoritative read path) —
 * never from the live, mutable `crawlers` table, and never from the static
 * Markdown crawler content collection. See
 * docs/research/POLICY_OBSERVATORY_ARCHITECTURE.md.
 */

const EVALUATION_ELIGIBLE_LIFECYCLE = new Set(["active", "deprecated", "replaced"]);
const REVIEW_DUE_DAYS = 180; // mirrors scripts/registry-tools.mjs's staleness threshold

export type RegistryObservatoryReleaseChangeSummary = {
  registryVersionId: string;
  versionLabel: string;
  publishedAt: string;
  entryCount: number;
  checksum: string | null;
  comparedToPreviousVersionId: string | null;
  added: number;
  removed: number;
  purposeChanges: number;
  tokenChanges: number;
  lifecycleChanges: number;
  evidenceOnlyChanges: number;
  editorialOnlyChanges: number;
};

export type RegistryObservatorySnapshot = {
  generatedAt: string;
  registryVersionId: string;
  versionLabel: string;
  publishedAt: string | null;
  checksum: string | null;
  /** Whether this release was the *active* one at the moment this snapshot
   * was computed — false when reproducing an older, pinned publication
   * after the active release has since moved on. */
  wasActiveAtGeneration: boolean;
  crawlerCount: number;
  operatorCount: number;
  evaluationEligibleCount: number;
  purposeDistribution: Record<string, number>;
  lifecycleDistribution: Record<string, number>;
  operatorByPurpose: { operatorId: string; operatorName: string; purposes: string[] }[];
  verification: {
    verifiedCount: number;
    neverVerifiedCount: number;
    oldestVerifiedAt: string | null;
    newestVerifiedAt: string | null;
    medianAgeDays: number | null;
    reviewDueCount: number;
  };
  releaseHistory: RegistryObservatoryReleaseChangeSummary[];
  totalReleases: number;
};

/**
 * Computes a full Registry Observatory snapshot for a *specific* registry
 * release (not necessarily the currently active one) — the general-purpose
 * function both the live public Observatory and publication reproduction
 * use. `crawlerCount`/`purposeDistribution`/etc. describe that release's own
 * entries; `releaseHistory` always covers every published release
 * regardless of which one `registryVersionId` refers to, since release
 * history is a fact about the registry as a whole, not about one release.
 */
export async function computeRegistryObservatoryForRelease(
  db: Database,
  registryVersionId: string,
): Promise<RegistryObservatorySnapshot> {
  const [release] = await db
    .select()
    .from(schema.registryVersions)
    .where(eq(schema.registryVersions.id, registryVersionId))
    .limit(1);
  if (!release) throw new Error(`Registry release "${registryVersionId}" not found.`);

  const snapshotMap = await getRegistryVersionSnapshotMap(db, release.id);
  const crawlers = [...snapshotMap.values()];

  const purposeDistribution: Record<string, number> = {};
  const lifecycleDistribution: Record<string, number> = {};
  const operatorPurposes = new Map<string, { operatorName: string; purposes: Set<string> }>();
  let evaluationEligibleCount = 0;
  let verifiedCount = 0;
  let neverVerifiedCount = 0;
  let reviewDueCount = 0;
  const verifiedTimestamps: number[] = [];
  const now = Date.now();

  for (const crawler of crawlers) {
    purposeDistribution[crawler.purpose] = (purposeDistribution[crawler.purpose] ?? 0) + 1;
    lifecycleDistribution[crawler.lifecycleStatus] =
      (lifecycleDistribution[crawler.lifecycleStatus] ?? 0) + 1;

    const operatorEntry = operatorPurposes.get(crawler.operatorId) ?? {
      operatorName: crawler.operatorName,
      purposes: new Set<string>(),
    };
    operatorEntry.purposes.add(crawler.purpose);
    operatorPurposes.set(crawler.operatorId, operatorEntry);

    const isEligible = EVALUATION_ELIGIBLE_LIFECYCLE.has(crawler.lifecycleStatus);
    if (isEligible) evaluationEligibleCount += 1;

    if (crawler.lastVerifiedAt) {
      verifiedCount += 1;
      const verifiedAt = Date.parse(crawler.lastVerifiedAt);
      if (!Number.isNaN(verifiedAt)) {
        verifiedTimestamps.push(verifiedAt);
        const ageDays = (now - verifiedAt) / 86_400_000;
        if (isEligible && ageDays > REVIEW_DUE_DAYS) reviewDueCount += 1;
      }
    } else {
      neverVerifiedCount += 1;
      if (isEligible) reviewDueCount += 1;
    }
  }

  verifiedTimestamps.sort((a, b) => a - b);
  const medianAgeDays = (() => {
    const count = verifiedTimestamps.length;
    if (count === 0) return null;
    const mid = Math.floor(count / 2);
    const lower = verifiedTimestamps[count % 2 === 0 ? mid - 1 : mid] as number;
    const upper = verifiedTimestamps[mid] as number;
    const medianTimestamp = (lower + upper) / 2;
    return Math.round((now - medianTimestamp) / 86_400_000);
  })();

  const operatorByPurpose = [...operatorPurposes.entries()]
    .map(([operatorId, entry]) => ({
      operatorId,
      operatorName: entry.operatorName,
      purposes: [...entry.purposes].sort(),
    }))
    .sort((a, b) => a.operatorName.localeCompare(b.operatorName));

  // Scoped to releases published at or before this one's own publication —
  // otherwise a publication pinned to this release would silently change
  // its "Results" narrative every time a *later* release is published,
  // breaking §199 reproducibility. A live public-facing snapshot (where
  // `release` is the active one) is unaffected, since no later release can
  // exist yet in that case.
  const releaseHistory = (await getRegistryObservatoryReleaseHistory(db)).filter(
    (entry) => !release.publishedAt || entry.publishedAt <= release.publishedAt,
  );

  return {
    generatedAt: new Date(now).toISOString(),
    registryVersionId: release.id,
    versionLabel: release.versionLabel,
    publishedAt: release.publishedAt,
    checksum: release.checksum,
    wasActiveAtGeneration: release.isActive,
    crawlerCount: crawlers.length,
    operatorCount: operatorPurposes.size,
    evaluationEligibleCount,
    purposeDistribution,
    lifecycleDistribution,
    operatorByPurpose,
    verification: {
      verifiedCount,
      neverVerifiedCount,
      oldestVerifiedAt:
        verifiedTimestamps.length > 0
          ? new Date(verifiedTimestamps[0] as number).toISOString()
          : null,
      newestVerifiedAt:
        verifiedTimestamps.length > 0
          ? new Date(verifiedTimestamps[verifiedTimestamps.length - 1] as number).toISOString()
          : null,
      medianAgeDays,
      reviewDueCount,
    },
    releaseHistory,
    totalReleases: releaseHistory.length,
  };
}

/**
 * Loads the current Registry Observatory snapshot from the active release —
 * the read path every public route uses. Returns null only if no active
 * registry release exists at all (should be structurally impossible in a
 * seeded environment — `registry:integrity:verify` asserts exactly one
 * active release).
 */
export async function getRegistryObservatorySnapshot(
  db: Database,
): Promise<RegistryObservatorySnapshot | null> {
  const [activeRelease] = await db
    .select({ id: schema.registryVersions.id })
    .from(schema.registryVersions)
    .where(eq(schema.registryVersions.isActive, true))
    .limit(1);
  if (!activeRelease) return null;
  return computeRegistryObservatoryForRelease(db, activeRelease.id);
}

/**
 * Computes a per-release change summary (newest first) for every published
 * release, using the same field-level semantic classification the admin
 * publish/rollback flow uses — never a raw string diff (Phase 15 §44).
 */
export async function getRegistryObservatoryReleaseHistory(
  db: Database,
): Promise<RegistryObservatoryReleaseChangeSummary[]> {
  const releases = await db
    .select()
    .from(schema.registryVersions)
    .where(isNotNull(schema.registryVersions.publishedAt))
    .orderBy(schema.registryVersions.publishedAt);

  const entryCounts = await db
    .select({
      registryVersionId: schema.registryVersionEntries.registryVersionId,
      crawlerId: schema.registryVersionEntries.crawlerId,
    })
    .from(schema.registryVersionEntries);
  const countByVersion = new Map<string, number>();
  for (const row of entryCounts) {
    countByVersion.set(row.registryVersionId, (countByVersion.get(row.registryVersionId) ?? 0) + 1);
  }

  const summaries: RegistryObservatoryReleaseChangeSummary[] = [];
  for (const [i, release] of releases.entries()) {
    const previous = i > 0 ? (releases[i - 1] ?? null) : null;

    let added = 0;
    let removed = 0;
    let purposeChanges = 0;
    let tokenChanges = 0;
    let lifecycleChanges = 0;
    let evidenceOnlyChanges = 0;
    let editorialOnlyChanges = 0;

    if (previous) {
      const diff = await computeSemanticDiff(db, previous.id, release.id);
      added = diff.added.length;
      removed = diff.removed.length;
      for (const entry of diff.changed) {
        if (entry.fieldChanges.some((f) => f.field === "purpose")) purposeChanges += 1;
        if (
          entry.fieldChanges.some(
            (f) => f.field === "userAgentToken" || f.field === "alternativeTokens",
          )
        )
          tokenChanges += 1;
        if (
          entry.fieldChanges.some(
            (f) => f.field === "lifecycleStatus" || f.field === "replacementCrawlerId",
          )
        )
          lifecycleChanges += 1;
        if (!entry.isEvaluationSemantic) {
          if (entry.fieldChanges.some((f) => f.changeClass === "evidence"))
            evidenceOnlyChanges += 1;
          else if (entry.fieldChanges.every((f) => f.changeClass === "editorial"))
            editorialOnlyChanges += 1;
        }
      }
    } else {
      added = countByVersion.get(release.id) ?? 0;
    }

    summaries.push({
      registryVersionId: release.id,
      versionLabel: release.versionLabel,
      publishedAt: release.publishedAt as string,
      entryCount: countByVersion.get(release.id) ?? 0,
      checksum: release.checksum,
      comparedToPreviousVersionId: previous?.id ?? null,
      added,
      removed,
      purposeChanges,
      tokenChanges,
      lifecycleChanges,
      evidenceOnlyChanges,
      editorialOnlyChanges,
    });
  }

  return summaries.reverse();
}
