import { eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

/**
 * Finding lifecycle classification across two comparable scans (Phase 8).
 * See docs/product/FINDING_LIFECYCLE_MODEL.md for the full rationale.
 */

export type FindingLifecycleState =
  "appeared" | "persisting" | "changed" | "resolved" | "unable_to_compare";

export type FindingLifecycleEntry = {
  fingerprint: string;
  state: FindingLifecycleState;
  title: string;
  severity: string;
  category: string;
  affectedCrawlerId: string | null;
  recommendedAction: string;
  previous: {
    severity: string;
    affectedCrawlerId: string | null;
    recommendedAction: string;
  } | null;
};

export type FindingCounts = {
  appeared: number;
  persisting: number;
  changed: number;
  resolved: number;
};

type FindingRow = typeof schema.findings.$inferSelect;

/**
 * `currentScanComparable` must be false whenever the current scan is not
 * `completed`/`completed_with_warnings` — a finding present previously and
 * absent from a partial/failed current scan must never be reported as
 * `resolved` (Phase 8's own explicit rule).
 */
export async function classifyFindingLifecycle(
  db: Database,
  params: { previousScanId: string | null; currentScanId: string; currentScanComparable: boolean },
): Promise<{ entries: FindingLifecycleEntry[]; counts: FindingCounts }> {
  const currentRows = await getFindingsForScan(db, params.currentScanId);

  if (!params.previousScanId) {
    // Baseline: every current finding is new by definition, but this isn't
    // a "lifecycle" comparison at all — return an empty classification, the
    // caller treats a baseline event's finding counts as all-zero per the
    // event model (baseline events don't carry lifecycle detail).
    return { entries: [], counts: { appeared: 0, persisting: 0, changed: 0, resolved: 0 } };
  }

  const previousRows = await getFindingsForScan(db, params.previousScanId);
  const previousByFingerprint = new Map(
    previousRows.filter((r) => r.fingerprint).map((r) => [r.fingerprint as string, r]),
  );
  const currentByFingerprint = new Map(
    currentRows.filter((r) => r.fingerprint).map((r) => [r.fingerprint as string, r]),
  );

  const entries: FindingLifecycleEntry[] = [];
  const counts: FindingCounts = { appeared: 0, persisting: 0, changed: 0, resolved: 0 };

  for (const [fingerprint, current] of currentByFingerprint) {
    const previous = previousByFingerprint.get(fingerprint);
    if (!previous) {
      counts.appeared++;
      entries.push(toEntry(fingerprint, current, "appeared", null));
      continue;
    }
    const changed =
      previous.severity !== current.severity ||
      previous.affectedCrawlerId !== current.affectedCrawlerId ||
      previous.recommendedAction !== current.recommendedAction ||
      previous.rulesetVersionId !== current.rulesetVersionId;
    if (changed) {
      counts.changed++;
      entries.push(toEntry(fingerprint, current, "changed", previous));
    } else {
      counts.persisting++;
      entries.push(toEntry(fingerprint, current, "persisting", previous));
    }
  }

  for (const [fingerprint, previous] of previousByFingerprint) {
    if (currentByFingerprint.has(fingerprint)) continue;
    if (!params.currentScanComparable) {
      entries.push(toEntry(fingerprint, previous, "unable_to_compare", null));
      continue;
    }
    counts.resolved++;
    entries.push(toEntry(fingerprint, previous, "resolved", null));
  }

  return { entries, counts };
}

function toEntry(
  fingerprint: string,
  row: FindingRow,
  state: FindingLifecycleState,
  previous: FindingRow | undefined | null,
): FindingLifecycleEntry {
  return {
    fingerprint,
    state,
    title: row.title,
    severity: row.severity,
    category: row.category,
    affectedCrawlerId: row.affectedCrawlerId,
    recommendedAction: row.recommendedAction,
    previous: previous
      ? {
          severity: previous.severity,
          affectedCrawlerId: previous.affectedCrawlerId,
          recommendedAction: previous.recommendedAction,
        }
      : null,
  };
}

async function getFindingsForScan(db: Database, scanId: string): Promise<FindingRow[]> {
  return db.select().from(schema.findings).where(eq(schema.findings.scanId, scanId));
}
