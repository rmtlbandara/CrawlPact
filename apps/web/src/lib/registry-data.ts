import { eq, inArray } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { RegistryCrawlerRow } from "./run-audit";

export type ActiveRegistry = {
  registryVersionId: string;
  rulesetVersionId: string;
  crawlers: RegistryCrawlerRow[];
};

/**
 * Reads the currently-active registry release and ruleset (ADR/schema:
 * `registry_versions.is_active` / `ruleset_versions.is_active`, enforced
 * unique by a partial index — see migration 0009) plus every crawler whose
 * lifecycle status is meaningful to evaluate against a live scan.
 * "unverified"/"retired" crawlers are excluded from evaluation (FR-REG-005:
 * nothing unverified is presented as an active policy signal).
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

  const rows = await db
    .select({
      id: schema.crawlers.id,
      name: schema.crawlers.name,
      operatorName: schema.crawlerOperators.name,
      userAgentToken: schema.crawlers.userAgentToken,
      purpose: schema.crawlers.purpose,
      lifecycleStatus: schema.crawlers.lifecycleStatus,
      replacementCrawlerId: schema.crawlers.replacementCrawlerId,
    })
    .from(schema.crawlers)
    .innerJoin(schema.crawlerOperators, eq(schema.crawlers.operatorId, schema.crawlerOperators.id))
    .where(inArray(schema.crawlers.lifecycleStatus, ["active", "deprecated", "replaced"]));

  return {
    registryVersionId: activeRegistryVersion.id,
    rulesetVersionId: activeRulesetVersion.id,
    crawlers: rows,
  };
}
