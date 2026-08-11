import { getRegistryVersionSnapshotMap, type CanonicalCrawlerSnapshot } from "./registry-snapshot";
import type { Database } from "@crawlpact/database";

/**
 * Phase 15 semantic release diff — see
 * `docs/registry/REGISTRY_SEMANTIC_DIFF_MODEL.md`.
 *
 * Replaces the pre-Phase-15 `compareRegistryVersions`, whose "changed"
 * detection was a raw full-snapshot string inequality: editing a crawler's
 * `description` wording, refreshing `lastVerifiedAt`, or moving
 * `officialSourceUrl` all counted as "changed" identically to a real token
 * or purpose change — which meant `getAffectedDomains`/`scheduleReEvaluation`
 * (wired from the publish route) could schedule customer re-evaluation for
 * a purely editorial or evidence-only edit. This file classifies each
 * per-crawler difference into exactly one of four classes so only
 * evaluation-semantic changes ever drive re-evaluation or a "policy
 * changed" changelog entry.
 */

export type ChangeClass = "evaluation_semantic" | "evidence" | "editorial" | "internal";

export type FieldChange = {
  field: keyof CanonicalCrawlerSnapshot;
  changeClass: ChangeClass;
  before: unknown;
  after: unknown;
};

export type CrawlerDiffEntry = {
  crawlerId: string;
  fieldChanges: FieldChange[];
  /** True if any field change in this crawler is evaluation-semantic. */
  isEvaluationSemantic: boolean;
};

export type RegistrySemanticDiff = {
  added: CanonicalCrawlerSnapshot[];
  removed: CanonicalCrawlerSnapshot[];
  changed: CrawlerDiffEntry[];
  /** Crawler IDs whose evaluation output could plausibly change — the only
   * set that should ever drive affected-domain computation. */
  evaluationSemanticCrawlerIds: string[];
};

const FIELD_CLASS: Record<keyof CanonicalCrawlerSnapshot, ChangeClass> = {
  schemaVersion: "internal",
  id: "internal",
  operatorId: "internal",
  operatorName: "editorial",
  name: "editorial",
  userAgentToken: "evaluation_semantic",
  alternativeTokens: "evaluation_semantic",
  purpose: "evaluation_semantic",
  description: "editorial",
  officialSourceUrl: "evidence",
  // Lifecycle transitions between active/deprecated/replaced can change
  // which crawlers are evaluated at all (a retire/unverify removes a
  // crawler from evaluation), so lifecycle is evaluation-semantic.
  lifecycleStatus: "evaluation_semantic",
  replacementCrawlerId: "evaluation_semantic",
  publishedIpInfo: "evidence",
  firstVerifiedAt: "evidence",
  lastVerifiedAt: "evidence",
};

function stableStringify(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort?.() ?? undefined);
}

function fieldsEqual(before: unknown, after: unknown): boolean {
  if (Array.isArray(before) && Array.isArray(after)) {
    return JSON.stringify([...before].sort()) === JSON.stringify([...after].sort());
  }
  if (
    typeof before === "object" &&
    before !== null &&
    typeof after === "object" &&
    after !== null
  ) {
    return stableStringify(before) === stableStringify(after);
  }
  return before === after;
}

function diffCrawler(
  before: CanonicalCrawlerSnapshot,
  after: CanonicalCrawlerSnapshot,
): CrawlerDiffEntry | null {
  const fieldChanges: FieldChange[] = [];
  for (const field of Object.keys(FIELD_CLASS) as (keyof CanonicalCrawlerSnapshot)[]) {
    if (field === "schemaVersion" || field === "id") continue;
    const beforeValue = before[field];
    const afterValue = after[field];
    if (!fieldsEqual(beforeValue, afterValue)) {
      fieldChanges.push({
        field,
        changeClass: FIELD_CLASS[field],
        before: beforeValue,
        after: afterValue,
      });
    }
  }
  if (fieldChanges.length === 0) return null;
  return {
    crawlerId: after.id,
    fieldChanges,
    isEvaluationSemantic: fieldChanges.some((c) => c.changeClass === "evaluation_semantic"),
  };
}

/** Computes the full semantic diff between two published releases. */
export async function computeSemanticDiff(
  db: Database,
  fromRegistryVersionId: string,
  toRegistryVersionId: string,
): Promise<RegistrySemanticDiff> {
  const [fromMap, toMap] = await Promise.all([
    getRegistryVersionSnapshotMap(db, fromRegistryVersionId),
    getRegistryVersionSnapshotMap(db, toRegistryVersionId),
  ]);

  const added: CanonicalCrawlerSnapshot[] = [];
  const removed: CanonicalCrawlerSnapshot[] = [];
  const changed: CrawlerDiffEntry[] = [];

  for (const [crawlerId, afterSnapshot] of toMap) {
    const beforeSnapshot = fromMap.get(crawlerId);
    if (!beforeSnapshot) {
      added.push(afterSnapshot);
      continue;
    }
    const diff = diffCrawler(beforeSnapshot, afterSnapshot);
    if (diff) changed.push(diff);
  }
  for (const [crawlerId, beforeSnapshot] of fromMap) {
    if (!toMap.has(crawlerId)) removed.push(beforeSnapshot);
  }

  const evaluationSemanticCrawlerIds = [
    ...added.map((c) => c.id),
    ...removed.map((c) => c.id),
    ...changed.filter((c) => c.isEvaluationSemantic).map((c) => c.crawlerId),
  ];

  return { added, removed, changed, evaluationSemanticCrawlerIds };
}
