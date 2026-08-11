import { eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { RegistryCrawlerRow } from "./run-audit";
import { getRegistryVersionSnapshotMap, type CanonicalCrawlerSnapshot } from "./registry-snapshot";

export type ActiveRegistry = {
  registryVersionId: string;
  rulesetVersionId: string;
  crawlers: RegistryCrawlerRow[];
};

/** Lifecycle states eligible for active policy evaluation. `unverified` and
 * `retired` crawlers are never evaluated (FR-REG-005) even though their
 * snapshot may still be present in a release for candidate/historical
 * purposes — see `resolveEvaluationRows` below. */
const EVALUATION_ELIGIBLE_LIFECYCLE = new Set(["active", "deprecated", "replaced"]);

/**
 * Phase 15 fix (see `docs/registry/PHASE_15_REGISTRY_BASELINE.md` "snapshot
 * authority audit"): filters a release's frozen snapshot map down to the
 * rows that are actually eligible to be evaluated as an active policy
 * signal, in the exact `RegistryCrawlerRow` shape the evaluator expects.
 */
export function resolveEvaluationRows(
  snapshotMap: Map<string, CanonicalCrawlerSnapshot>,
): RegistryCrawlerRow[] {
  const rows: RegistryCrawlerRow[] = [];
  for (const snapshot of snapshotMap.values()) {
    if (!EVALUATION_ELIGIBLE_LIFECYCLE.has(snapshot.lifecycleStatus)) continue;
    rows.push({
      id: snapshot.id,
      name: snapshot.name,
      operatorName: snapshot.operatorName,
      userAgentToken: snapshot.userAgentToken,
      purpose: snapshot.purpose,
      lifecycleStatus: snapshot.lifecycleStatus,
      replacementCrawlerId: snapshot.replacementCrawlerId,
    });
  }
  return rows;
}

/**
 * Reads the currently-active registry release and ruleset (ADR/schema:
 * `registry_versions.is_active` / `ruleset_versions.is_active`, enforced
 * unique by a partial index — see migration 0009) and resolves every
 * evaluation-eligible crawler from that release's own immutable
 * `registry_version_entries` snapshot.
 *
 * Phase 15 fix: previously this joined straight back to the live, mutable
 * `crawlers`/`crawler_operators` tables — meaning editing a crawler's row
 * after a release was published silently changed what the *already-active*
 * release evaluated new scans against, defeating the entire point of a
 * "published, immutable release." The snapshot taken at release-creation
 * time is now the sole source of truth for evaluation.
 */
export async function getActiveRegistry(db: Database): Promise<ActiveRegistry | null> {
  const [activeRegistryVersion] = await db
    .select({ id: schema.registryVersions.id })
    .from(schema.registryVersions)
    .where(eq(schema.registryVersions.isActive, true))
    .limit(1);

  const [activeRulesetVersion] = await db
    .select({ id: schema.rulesetVersions.id })
    .from(schema.rulesetVersions)
    .where(eq(schema.rulesetVersions.isActive, true))
    .limit(1);

  if (!activeRegistryVersion || !activeRulesetVersion) return null;

  const snapshotMap = await getRegistryVersionSnapshotMap(db, activeRegistryVersion.id);

  return {
    registryVersionId: activeRegistryVersion.id,
    rulesetVersionId: activeRulesetVersion.id,
    crawlers: resolveEvaluationRows(snapshotMap),
  };
}
