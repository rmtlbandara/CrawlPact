import { eq, gte, sql } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

/**
 * SRS §28.9 scan operations dashboard. Two fields the SRS lists —
 * "pending scans" and "retrying scans" — have no real data behind them in
 * this architecture: every scan runs synchronously to completion (or
 * failure) within a single request; there is no queue or background retry
 * mechanism (see docs/status/KNOWN_RISKS.md). Rather than fabricate a
 * plausible-looking number, this always reports 0 for both, labelled with
 * why, so the dashboard stays honest about what the product actually does.
 */
export async function getScanOperationsSummary(db: Database, sinceIso: string) {
  const [started, completed, failed, avgRequests, pausedDomains] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.scans)
      .where(gte(schema.scans.startedAt, sinceIso)),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.scans)
      .where(
        sql`${schema.scans.startedAt} >= ${sinceIso} and ${schema.scans.status} in ('completed', 'completed_with_warnings')`,
      ),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.scans)
      .where(
        sql`${schema.scans.startedAt} >= ${sinceIso} and ${schema.scans.status} in ('incomplete', 'target_unavailable', 'blocked_for_safety', 'internal_failure')`,
      ),
    db
      .select({ avg: sql<number>`avg(${schema.scans.externalRequestCount})` })
      .from(schema.scans)
      .where(gte(schema.scans.startedAt, sinceIso)),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.domains)
      .where(eq(schema.domains.monitoringState, "paused")),
  ]);

  const durationRows = await db
    .select({ startedAt: schema.scans.startedAt, completedAt: schema.scans.completedAt })
    .from(schema.scans)
    .where(gte(schema.scans.startedAt, sinceIso));
  const durations = durationRows
    .filter((r) => r.completedAt)
    .map((r) => new Date(r.completedAt!).getTime() - new Date(r.startedAt).getTime());
  const averageDurationMs =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;

  const failureCategoryRows = await db
    .select({ category: schema.scans.errorCategory, n: sql<number>`count(*)` })
    .from(schema.scans)
    .where(
      sql`${schema.scans.startedAt} >= ${sinceIso} and ${schema.scans.errorCategory} is not null`,
    )
    .groupBy(schema.scans.errorCategory);

  return {
    started: started[0]?.n ?? 0,
    completed: completed[0]?.n ?? 0,
    failed: failed[0]?.n ?? 0,
    pending: 0,
    retrying: 0,
    pendingRetryingNote:
      "This scanner runs synchronously — there is no queue, so these are always 0.",
    pausedDomains: pausedDomains[0]?.n ?? 0,
    averageDurationMs,
    averageExternalRequests: avgRequests[0]?.avg ?? null,
    failureCategories: failureCategoryRows.map((r) => ({ category: r.category, count: r.n })),
  };
}

/** SRS §28.9 error-class filter. Limited to the categories the scanner
 * actually produces (`packages/scanner/src/safe-fetch.ts`'s
 * `FetchFailureCategory`) — no fabricated "TLS"/"parser error"/"application
 * error"/HTTP-status buckets that don't correspond to a real tracked field.
 * See docs/status/KNOWN_RISKS.md for the exact, disclosed gap against the
 * SRS's fuller wishlist. */
export const REAL_FAILURE_CATEGORIES = [
  "dns",
  "connection_failed",
  "timeout",
  "too_many_redirects",
  "redirect_loop",
  "unsafe_redirect_target",
  "size_limit_exceeded",
  "unsafe_target",
  "unknown",
] as const;
