import { and, asc, desc, eq, exists, inArray, lt, not, or } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

/**
 * Paginated, filterable scan history and retention-boundary messaging
 * (Phase 8). See docs/product/SCAN_HISTORY_AND_RETENTION_UX.md.
 */

export type ScanHistoryFilter =
  | "all"
  | "manual"
  | "scheduled"
  | "successful"
  | "partial"
  | "failed"
  | "change_detected"
  | "no_material_change";

export type ScanHistoryRow = {
  scanId: string;
  status: string;
  score: number | null;
  triggeredBy: string;
  startedAt: string;
  registryVersionId: string | null;
  changeDetected: boolean;
};

export type ScanHistoryCursor = { startedAt: string; scanId: string };

type ScanStatus = typeof schema.scans.$inferSelect.status;
const SUCCESSFUL: ScanStatus[] = ["completed", "completed_with_warnings"];
const FAILED: ScanStatus[] = [
  "target_unavailable",
  "blocked_for_safety",
  "rate_limited",
  "internal_failure",
];

export async function listScanHistory(
  db: Database,
  domainId: string,
  options: { filter?: ScanHistoryFilter; limit?: number; cursor?: ScanHistoryCursor | null } = {},
): Promise<{ scans: ScanHistoryRow[]; nextCursor: ScanHistoryCursor | null }> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const filter = options.filter ?? "all";

  const conditions = [eq(schema.scans.domainId, domainId)];
  if (options.cursor) {
    conditions.push(
      or(
        lt(schema.scans.startedAt, options.cursor.startedAt),
        and(
          eq(schema.scans.startedAt, options.cursor.startedAt),
          lt(schema.scans.id, options.cursor.scanId),
        ),
      )!,
    );
  }
  if (filter === "manual") conditions.push(eq(schema.scans.triggeredBy, "manual"));
  if (filter === "scheduled") conditions.push(eq(schema.scans.triggeredBy, "scheduled"));
  if (filter === "successful") conditions.push(inArray(schema.scans.status, SUCCESSFUL));
  if (filter === "failed") conditions.push(inArray(schema.scans.status, FAILED));
  if (filter === "partial") conditions.push(eq(schema.scans.status, "incomplete"));
  if (filter === "change_detected" || filter === "no_material_change") {
    const hasEvent = exists(
      db
        .select({ one: schema.domainChangeEvents.id })
        .from(schema.domainChangeEvents)
        .where(eq(schema.domainChangeEvents.currentScanId, schema.scans.id)),
    );
    conditions.push(filter === "change_detected" ? hasEvent : not(hasEvent));
  }

  const rows = await db
    .select()
    .from(schema.scans)
    .where(and(...conditions))
    .orderBy(desc(schema.scans.startedAt), desc(schema.scans.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const changeEventScanIds = new Set(
    (
      await db
        .select({ currentScanId: schema.domainChangeEvents.currentScanId })
        .from(schema.domainChangeEvents)
        .where(
          inArray(
            schema.domainChangeEvents.currentScanId,
            page.map((r) => r.id),
          ),
        )
    ).map((r) => r.currentScanId),
  );

  const scans: ScanHistoryRow[] = page.map((row) => ({
    scanId: row.id,
    status: row.status,
    score: row.score,
    triggeredBy: row.triggeredBy,
    startedAt: row.startedAt,
    registryVersionId: row.registryVersionId,
    changeDetected: changeEventScanIds.has(row.id),
  }));

  const last = page.at(-1);
  return {
    scans,
    nextCursor: hasMore && last ? { startedAt: last.startedAt, scanId: last.id } : null,
  };
}

export type RetentionBoundary = {
  retentionDays: number;
  retentionMonths: number;
  oldestRetainedScanAt: string | null;
  hasExpiredHistory: boolean;
};

/**
 * `hasExpiredHistory` is a best-effort signal: true when the domain's
 * oldest retained scan is itself already older than half the retention
 * window (a purge sweep runs periodically, not continuously, so "the oldest
 * row we still have is old" is the honest signal available — this never
 * claims certainty about rows that no longer exist to inspect).
 */
export async function retentionBoundaryFor(
  db: Database,
  domainId: string,
  retentionDays: number,
): Promise<RetentionBoundary> {
  const [oldest] = await db
    .select({ startedAt: schema.scans.startedAt })
    .from(schema.scans)
    .where(eq(schema.scans.domainId, domainId))
    .orderBy(asc(schema.scans.startedAt))
    .limit(1);

  const oldestRetainedScanAt = oldest?.startedAt ?? null;
  const hasExpiredHistory = Boolean(
    oldestRetainedScanAt &&
    Date.now() - new Date(oldestRetainedScanAt).getTime() >
      (retentionDays / 2) * 24 * 60 * 60 * 1000,
  );

  return {
    retentionDays,
    retentionMonths: Math.round(retentionDays / 30),
    oldestRetainedScanAt,
    hasExpiredHistory,
  };
}
