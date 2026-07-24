import { and, desc, eq, gt, isNull, like, or, sql } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { PolicyPreset } from "@crawlpact/policy";
import { getActiveRegistry } from "../registry-data";
import { runAudit } from "../run-audit";
import { persistScan } from "../persist-scan";
import { recordScanOnDomain } from "../domains";
import { getBlockedTargetPatterns } from "../blocked-targets";
import { getIntConfig } from "../runtime-config";
import type { AuditResult } from "../run-audit";

export type DomainFilters = { query?: string; monitoringState?: "active" | "paused" };

/** Hard ceiling on rows returned in one call — the admin UI doesn't yet page
 * through results beyond this (see docs/performance/PERFORMANCE_AND_COST.md),
 * but this at minimum stops an unbounded scan of every domain on every page
 * load regardless of how large the customer base grows. */
const MAX_DOMAINS_PER_LIST = 200;

/**
 * SRS §28.8: global domain table across every customer. Filters are pushed
 * into SQL (rather than fetched-then-filtered in JS, the Part 3 Step 4-6
 * original shape) so a search only ever touches the matching rows, and the
 * per-domain critical-findings count is a single LEFT JOIN + GROUP BY
 * instead of one extra query per row (Part 3 Step 19 — the latter was a
 * genuine N+1 that scaled with every saved domain across every customer).
 */
export async function listAllDomains(db: Database, filters: DomainFilters = {}) {
  const conditions = [isNull(schema.domains.deletedAt)];
  if (filters.monitoringState) {
    conditions.push(eq(schema.domains.monitoringState, filters.monitoringState));
  }
  if (filters.query) {
    const like_ = `%${filters.query}%`;
    const queryMatch = or(
      like(schema.domains.canonicalOrigin, like_),
      like(schema.users.displayName, like_),
    );
    if (queryMatch) conditions.push(queryMatch);
  }

  const rows = await db
    .select({
      domain: schema.domains,
      owner: {
        id: schema.users.id,
        displayName: schema.users.displayName,
        planId: schema.users.planId,
      },
      criticalFindingsCount: sql<number>`count(${schema.findings.id})`,
    })
    .from(schema.domains)
    .innerJoin(schema.users, eq(schema.domains.ownerUserId, schema.users.id))
    .leftJoin(
      schema.findings,
      and(
        eq(schema.findings.scanId, schema.domains.lastScanId),
        eq(schema.findings.severity, "critical"),
      ),
    )
    .where(and(...conditions))
    .groupBy(schema.domains.id, schema.users.id, schema.users.displayName, schema.users.planId)
    .orderBy(desc(schema.domains.updatedAt))
    .limit(MAX_DOMAINS_PER_LIST);

  return rows;
}

export async function setDomainMonitoringState(
  db: Database,
  domainId: string,
  state: "active" | "paused",
): Promise<void> {
  await db
    .update(schema.domains)
    .set({ monitoringState: state, updatedAt: new Date().toISOString() })
    .where(eq(schema.domains.id, domainId));
}

/** SRS §28.8: "Administrative scans shall not consume customer quotas" — this
 * bypasses `countManualScansThisMonth`/plan-limit checks entirely (unlike
 * `/api/domains/:id/scan`) and does not reschedule the domain's normal
 * monitoring cadence, since it's an out-of-band diagnostic run. */
export async function triggerAdminScan(
  db: Database,
  domainId: string,
  adminUserId: string,
): Promise<{ scanId: string; result: AuditResult } | { error: string }> {
  const [domain] = await db
    .select()
    .from(schema.domains)
    .where(eq(schema.domains.id, domainId))
    .limit(1);
  if (!domain) return { error: "Domain not found." };

  const registry = await getActiveRegistry(db);
  if (!registry) return { error: "No active crawler registry release is configured." };

  const blocklist = await getBlockedTargetPatterns(db);
  const totalTimeoutMs = (await getIntConfig(db, "scan_total_timeout_seconds", 30)) * 1000;
  const result = await runAudit(
    domain.canonicalOrigin,
    domain.preset as PolicyPreset,
    registry.crawlers,
    registry.rulesetVersionId,
    { blocklist, totalTimeoutMs },
  );

  const scanId = crypto.randomUUID();
  await persistScan(
    db,
    {
      scanId,
      targetInput: domain.canonicalOrigin,
      preset: domain.preset,
      registryVersionId: registry.registryVersionId,
      rulesetVersionId: registry.rulesetVersionId,
      domainId: domain.id,
      triggeredBy: "admin",
      triggeredByUserId: adminUserId,
    },
    result,
  );

  await recordScanOnDomain(db, domain.id, {
    scanId,
    score: result.score.state === "scored" ? result.score.value : null,
    nextScanAt: domain.nextScanAt,
  });

  return { scanId, result };
}

/**
 * SRS §28.9: hosts with an unusually high failure rate, for the scan
 * operations dashboard. Scoped to the last `windowDays` (default 90) so the
 * aggregation doesn't scan the entire, ever-growing `scans` table on every
 * dashboard load — a failure pattern older than that isn't actionable
 * "current" operational signal anyway (Part 3 Step 19).
 */
export async function getHighFailureHosts(db: Database, minFailures = 2, windowDays = 90) {
  const sinceIso = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const rows = await db
    .select({
      canonicalOrigin: schema.scans.canonicalOrigin,
      failures: sql<number>`count(*)`,
    })
    .from(schema.scans)
    .where(
      and(
        sql`${schema.scans.status} in ('incomplete', 'target_unavailable', 'blocked_for_safety', 'internal_failure')`,
        sql`${schema.scans.startedAt} >= ${sinceIso}`,
      ),
    )
    .groupBy(schema.scans.canonicalOrigin)
    .having(gt(sql`count(*)`, minFailures - 1))
    .orderBy(desc(sql`count(*)`))
    .limit(20);
  return rows;
}
