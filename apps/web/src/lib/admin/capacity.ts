import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

/**
 * Operational capacity snapshot (Phase 11, Stage 11H). A read-only admin
 * view of the metrics `docs/operations/PHASE_11_OPERATIONAL_CAPACITY_VIEW.md`
 * documents in full, including which ones this function deliberately does
 * NOT compute and why (several of the metrics the phase named — Cloudflare
 * account plan, Worker CPU-limit error counts, build bundle size — are not
 * obtainable from inside a running Worker's own bindings at all; they
 * require the Cloudflare account-management API or CI build output, both
 * outside what this Worker can query about itself. Fabricating a number for
 * any of those would violate this codebase's "never present fabricated
 * data as a real outcome" rule — see CLAUDE.md — so this function reports
 * `null` for them with an explanation, not a guess).
 *
 * Every number below is a real, current D1/R2 query — no cached/estimated
 * values, matching this phase's "measure, don't assume" discipline
 * throughout (see `docs/performance/PHASE_11_PRODUCTION_CAPACITY_BASELINE.md`).
 */

export type OperationalCapacitySnapshot = {
  d1: {
    tableCount: number;
  };
  r2: {
    /** Bounded to the first 1,000 objects in AGENCY_LOGOS — this bucket has
     * no pagination need at real volume (see the Stage 11D orphan-cleanup
     * doc), but this is still a real count of what was actually listed, not
     * an extrapolation, and `truncated` discloses if the bound was hit. */
    agencyLogosObjectCount: number;
    truncated: boolean;
  };
  scans: {
    last24h: number;
    avgResourceBytesPerScan: number | null;
    avgFindingsPerScan: number | null;
    /** Derived from the same real formula used in the Stage 11A baseline:
     * 1 (scans) + real scan_resources rows/scan + real scan_crawler_results
     * rows/scan + real findings rows/scan, all measured from actual rows,
     * not the original design-time estimate. */
    avgD1StatementsPerScan: number | null;
  };
  monitoring: {
    dueNowCount: number;
    /** Null if nothing is currently overdue. */
    oldestOverdueNextScanAt: string | null;
  };
  retention: {
    lastRun: { status: string; startedAt: string; completedAt: string | null } | null;
  };
  /** Deliberately not computed — see the module doc comment and
   * docs/operations/PHASE_11_OPERATIONAL_CAPACITY_VIEW.md for why each is
   * out of a Worker's own reach. `d1SizeBytes` was attempted (`PRAGMA
   * page_count`/`page_size`) and found, via a real failing D1 call against
   * both this Miniflare harness and (per the Stage 11A baseline doc's own
   * methodology) production, to be a PRAGMA D1's binding API rejects with
   * SQLITE_AUTH — genuinely not obtainable from inside a Worker, not merely
   * unimplemented. */
  notAvailableFromThisWorker: {
    cloudflarePlan: null;
    workerCpuLimitErrors: null;
    bundleSizeBytes: null;
    d1SizeBytes: null;
  };
};

export async function getOperationalCapacitySnapshot(
  db: Database,
  rawDb: D1Database,
  agencyLogos: R2Bucket,
): Promise<OperationalCapacitySnapshot> {
  const now = new Date();
  const nowIso = now.toISOString();
  const last24hIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [
    tableCountRow,
    r2List,
    scansLast24hRow,
    avgResourceBytesRow,
    avgFindingsRow,
    scanCountRow,
    scanResourcesCountRow,
    scanCrawlerResultsCountRow,
    findingsCountRow,
    dueNowRows,
    lastRetentionRow,
  ] = await Promise.all([
    // Raw D1 binding, not the Drizzle wrapper — sqlite_master queries
    // aren't expressible through Drizzle's query builder, and this is the
    // same real API (`D1Database.prepare().first()`) worker.ts and the
    // retention job already use directly for cases the builder can't cover.
    // (D1 database *size* was also attempted this way — `PRAGMA page_count`/
    // `page_size` — and found to be rejected by D1's binding API with
    // SQLITE_AUTH, confirmed by a real failing call against this exact
    // harness; that metric moved to `notAvailableFromThisWorker` instead.)
    rawDb
      .prepare(
        "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'",
      )
      .first<number>("n"),
    agencyLogos.list({ limit: 1000 }),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.scans)
      .where(sql`${schema.scans.startedAt} >= ${last24hIso}`),
    db
      .select({ n: sql<number>`avg(${schema.scanResources.contentSizeBytes})` })
      .from(schema.scanResources),
    db.select({ n: sql<number>`count(*)` }).from(schema.findings),
    db.select({ n: sql<number>`count(*)` }).from(schema.scans),
    db.select({ n: sql<number>`count(*)` }).from(schema.scanResources),
    db.select({ n: sql<number>`count(*)` }).from(schema.scanCrawlerResults),
    db.select({ n: sql<number>`count(*)` }).from(schema.findings),
    db
      .select({ nextScanAt: schema.domains.nextScanAt })
      .from(schema.domains)
      .where(
        and(
          eq(schema.domains.monitoringState, "active"),
          isNull(schema.domains.deletedAt),
          or(isNull(schema.domains.nextScanAt), lte(schema.domains.nextScanAt, nowIso)),
        ),
      ),
    db
      .select({
        status: schema.scheduledJobRuns.status,
        startedAt: schema.scheduledJobRuns.startedAt,
        completedAt: schema.scheduledJobRuns.completedAt,
      })
      .from(schema.scheduledJobRuns)
      .where(eq(schema.scheduledJobRuns.jobName, "data_retention_purge"))
      .orderBy(sql`${schema.scheduledJobRuns.startedAt} desc`)
      .limit(1),
  ]);

  const scanCount = Number(scanCountRow[0]?.n ?? 0);
  const avgD1StatementsPerScan =
    scanCount === 0
      ? null
      : 1 +
        Number(scanResourcesCountRow[0]?.n ?? 0) / scanCount +
        Number(scanCrawlerResultsCountRow[0]?.n ?? 0) / scanCount +
        Number(findingsCountRow[0]?.n ?? 0) / scanCount;

  const overdueTimestamps = dueNowRows
    .map((r) => r.nextScanAt)
    .filter((v): v is string => v !== null)
    .sort();

  return {
    d1: {
      tableCount: tableCountRow ?? 0,
    },
    r2: {
      agencyLogosObjectCount: r2List.objects.length,
      truncated: r2List.truncated,
    },
    scans: {
      last24h: Number(scansLast24hRow[0]?.n ?? 0),
      avgResourceBytesPerScan: avgResourceBytesRow[0]?.n ?? null,
      avgFindingsPerScan: scanCount === 0 ? null : Number(avgFindingsRow[0]?.n ?? 0) / scanCount,
      avgD1StatementsPerScan,
    },
    monitoring: {
      dueNowCount: dueNowRows.length,
      oldestOverdueNextScanAt: overdueTimestamps[0] ?? null,
    },
    retention: {
      lastRun: lastRetentionRow[0] ?? null,
    },
    notAvailableFromThisWorker: {
      cloudflarePlan: null,
      workerCpuLimitErrors: null,
      bundleSizeBytes: null,
      d1SizeBytes: null,
    },
  };
}
