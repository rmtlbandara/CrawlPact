import { eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { getRegistryVersionSnapshotMap } from "../registry-snapshot";
import { verifyRegistryChecksum } from "../registry-checksum";

/**
 * Phase 15 §125 — a safe, read-only runtime check of the active registry
 * release's integrity, surfaced in `/admin/operations` (Phase 14). This is
 * not customer-facing: a stale source-review queue or a checksum
 * recomputation mismatch is an internal signal, not a public outage (§126)
 * — only a genuinely corrupted/invalid active registry that would produce
 * incorrect audits should ever influence public `/status`, and none of
 * these checks are wired to public status this phase (no evidence of
 * customer impact exists to justify that yet).
 */
export type RegistryHealthCheck = {
  activeReleaseId: string | null;
  activeReleaseVersionLabel: string | null;
  activeReleasePublished: boolean;
  activeRulesetExists: boolean;
  checksumValid: boolean | null;
  entriesParseCleanly: boolean;
  duplicateEvaluationTokens: string[];
  unverifiedEvaluationEntries: string[];
  reviewDueCount: number;
};

const STALE_VERIFICATION_DAYS = 180;

export async function getRegistryHealth(db: Database): Promise<RegistryHealthCheck> {
  const [activeVersion] = await db
    .select()
    .from(schema.registryVersions)
    .where(eq(schema.registryVersions.isActive, true))
    .limit(1);

  const [activeRuleset] = await db
    .select({ id: schema.rulesetVersions.id })
    .from(schema.rulesetVersions)
    .where(eq(schema.rulesetVersions.isActive, true))
    .limit(1);

  if (!activeVersion) {
    return {
      activeReleaseId: null,
      activeReleaseVersionLabel: null,
      activeReleasePublished: false,
      activeRulesetExists: Boolean(activeRuleset),
      checksumValid: null,
      entriesParseCleanly: false,
      duplicateEvaluationTokens: [],
      unverifiedEvaluationEntries: [],
      reviewDueCount: 0,
    };
  }

  let entriesParseCleanly = true;
  let snapshotMap: Awaited<ReturnType<typeof getRegistryVersionSnapshotMap>>;
  try {
    snapshotMap = await getRegistryVersionSnapshotMap(db, activeVersion.id);
  } catch {
    entriesParseCleanly = false;
    snapshotMap = new Map();
  }

  const seenTokens = new Map<string, string[]>();
  const unverifiedEvaluationEntries: string[] = [];
  let reviewDueCount = 0;
  const now = Date.now();
  const evaluationLifecycle = new Set(["active", "deprecated", "replaced"]);

  for (const snapshot of snapshotMap.values()) {
    if (!evaluationLifecycle.has(snapshot.lifecycleStatus)) continue;
    const key = snapshot.userAgentToken.toLowerCase();
    seenTokens.set(key, [...(seenTokens.get(key) ?? []), snapshot.id]);
    if (snapshot.lifecycleStatus === "active" && !snapshot.lastVerifiedAt) {
      unverifiedEvaluationEntries.push(snapshot.id);
    }
    if (snapshot.lastVerifiedAt) {
      const ageDays = (now - Date.parse(snapshot.lastVerifiedAt)) / 86_400_000;
      if (ageDays > STALE_VERIFICATION_DAYS) reviewDueCount += 1;
    }
  }
  const duplicateEvaluationTokens = [...seenTokens.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([token]) => token);

  let checksumValid: boolean | null = null;
  if (activeVersion.checksum) {
    const result = await verifyRegistryChecksum(db, activeVersion.id);
    checksumValid = result.matches;
  }

  return {
    activeReleaseId: activeVersion.id,
    activeReleaseVersionLabel: activeVersion.versionLabel,
    activeReleasePublished: Boolean(activeVersion.publishedAt),
    activeRulesetExists: Boolean(activeRuleset),
    checksumValid,
    entriesParseCleanly,
    duplicateEvaluationTokens,
    unverifiedEvaluationEntries,
    reviewDueCount,
  };
}
