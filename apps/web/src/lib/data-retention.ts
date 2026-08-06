import { and, count, eq, inArray, isNotNull, isNull, lt, notInArray } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { ACCOUNT_DELETION_GRACE_PERIOD_DAYS } from "./account";
import { resolveRealEntitledPlan } from "./admin/subscriptions";
import { getIntConfig } from "./runtime-config";
import { findAndCleanupOrphanedLogos } from "./r2-orphan-cleanup";

/**
 * Data retention purge (docs/data/DATA_RETENTION.md, SRS §34, Part 2 Step
 * 19). Runs daily from the same cron as the monitoring sweep
 * (worker.ts). Cascade-delete FKs (see every `ON DELETE CASCADE` in the
 * migrations) do the bulk of the work once the "root" row — a scan or a
 * user — is removed, so this stays a short list of targeted deletes
 * rather than needing to touch every table by hand.
 *
 * Phase 11 (Stage 11D) hardening: every category below now (1) deletes in
 * bounded chunks rather than one unbounded statement, so a large backlog
 * can never make a single cron invocation exceed its CPU/time budget — a
 * category that still has more to purge after RETENTION_MAX_CHUNKS chunks
 * simply reports `backlogRemaining: true` and finishes the rest on the next
 * scheduled run (this is safe specifically because every WHERE clause below
 * re-evaluates "is this row still eligible" from scratch each run — there is
 * no per-run state to lose); (2) runs behind a `dryRun` option that reports
 * real, exact counts (via `COUNT(*)`, not a chunk-bounded estimate) without
 * deleting anything, for admin/CLI verification before trusting a change to
 * this file; (3) isolates each category's failure — one category throwing
 * no longer prevents the others from running, matching
 * `docs/data/PHASE_11_RETENTION_DECISION_MATRIX.md`'s failure-isolation
 * requirement.
 */

const ANONYMOUS_SCAN_RETENTION_DAYS = 7;

/** Rows deleted per DELETE statement — confirmed via a real Miniflare D1
 * integration probe that `DELETE ... LIMIT` is supported by this D1
 * dialect before relying on it here. Bounds both the single-statement cost
 * and (via RETENTION_MAX_CHUNKS) the total work a single cron invocation
 * can do. */
const RETENTION_CHUNK_SIZE = 500;

/** Safety cap on chunks per category per invocation — at the chunk size
 * above, up to 10,000 rows/category/run. A category that hits this cap
 * still made real, bounded progress and will pick up exactly where it left
 * off next run (every WHERE clause is re-evaluated fresh, not cursor-based),
 * rather than risking one oversized backlog starving every other category
 * or blowing the Worker's CPU budget in a single invocation. */
const RETENTION_MAX_CHUNKS = 20;

function daysAgo(days: number, now: Date): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

export type CategoryResult = {
  /** Real rows deleted/reverted this invocation (0 in dry-run mode — see `wouldAffect`). */
  affected: number;
  /** Dry-run only: the real, exact `COUNT(*)` of rows currently eligible — not chunk-bounded. */
  wouldAffect: number | null;
  /** True if RETENTION_MAX_CHUNKS was reached while real rows remained eligible — more work is
   * left for the next scheduled run, this was not a full purge of the current backlog. */
  backlogRemaining: boolean;
  /** Set if this category's own operation threw — never prevents other categories from running. */
  error: string | null;
};

function emptyCategoryResult(): CategoryResult {
  return { affected: 0, wouldAffect: null, backlogRemaining: false, error: null };
}

/** After a chunked loop exits with a full last chunk, whether the category's
 * bounded work is actually done is genuinely unknown without checking — the
 * eligible row count could be an exact multiple of chunkSize, in which case
 * nothing is left. Only called in that case, with a real `COUNT(*)` against
 * the same current WHERE clause — never assumed from "the last chunk was
 * full", which is wrong whenever the backlog divides evenly by chunkSize. */
async function hasRowsMatching(countQuery: Promise<{ n: number }[]>): Promise<boolean> {
  const [row] = await countQuery;
  return (row?.n ?? 0) > 0;
}

/** Anonymous (unowned) scans: 24h–7d per the retention table — purged after 7 days
 * by default, admin-tunable via runtime_configuration (SRS §28.16). */
async function purgeAnonymousScans(
  db: Database,
  now: Date,
  dryRun: boolean,
  chunkSize: number,
  maxChunks: number,
): Promise<CategoryResult> {
  const retentionDays = await getIntConfig(
    db,
    "anonymous_scan_retention_days",
    ANONYMOUS_SCAN_RETENTION_DAYS,
  );
  const cutoff = daysAgo(retentionDays, now);
  const where = and(isNull(schema.scans.domainId), lt(schema.scans.startedAt, cutoff));

  if (dryRun) {
    const [row] = await db.select({ n: count() }).from(schema.scans).where(where);
    return { ...emptyCategoryResult(), wouldAffect: row?.n ?? 0 };
  }

  let affected = 0;
  let lastChunkFull = false;
  for (let i = 0; i < maxChunks; i++) {
    const result = await db
      .delete(schema.scans)
      .where(where)
      .limit(chunkSize)
      .returning({ id: schema.scans.id });
    affected += result.length;
    lastChunkFull = result.length === chunkSize;
    if (!lastChunkFull) break;
  }
  const backlogRemaining = lastChunkFull
    ? await hasRowsMatching(db.select({ n: count() }).from(schema.scans).where(where))
    : false;
  return { ...emptyCategoryResult(), affected, backlogRemaining };
}

/**
 * Owned-domain scan history: retention is the domain owner's *current*
 * plan (`plans.history_retention_days`) — matches the documented table
 * (free 30d ... agency 36mo). The domain's own `last_scan_id` is always
 * kept regardless of age, so a rarely-rescanned domain never loses its
 * current baseline/score.
 *
 * Grouped by plan (always exactly 4 rows) rather than looping per domain
 * (Part 3 Step 19 fix) — the previous shape fetched every domain in the
 * system and issued one DELETE per domain on every single daily cron run,
 * which scaled with total domain count regardless of how many domains
 * actually had anything to purge. One bulk (now chunked) DELETE per plan
 * does the same work in a bounded number of statements.
 */
async function purgeExpiredDomainScans(
  db: Database,
  now: Date,
  dryRun: boolean,
  chunkSize: number,
  maxChunks: number,
): Promise<CategoryResult> {
  const plans = await db
    .select({ id: schema.plans.id, retentionDays: schema.plans.historyRetentionDays })
    .from(schema.plans);

  const keptBaselines = db
    .select({ id: schema.domains.lastScanId })
    .from(schema.domains)
    .where(isNotNull(schema.domains.lastScanId));

  let affected = 0;
  let wouldAffect = dryRun ? 0 : null;
  let backlogRemaining = false;

  for (const plan of plans) {
    const cutoff = daysAgo(plan.retentionDays, now);
    const domainIdsOnPlan = db
      .select({ id: schema.domains.id })
      .from(schema.domains)
      .innerJoin(schema.users, eq(schema.domains.ownerUserId, schema.users.id))
      .where(eq(schema.users.planId, plan.id));
    const where = and(
      inArray(schema.scans.domainId, domainIdsOnPlan),
      lt(schema.scans.startedAt, cutoff),
      notInArray(schema.scans.id, keptBaselines),
    );

    if (dryRun) {
      const [row] = await db.select({ n: count() }).from(schema.scans).where(where);
      wouldAffect = (wouldAffect ?? 0) + (row?.n ?? 0);
      continue;
    }

    let lastChunkFull = false;
    for (let i = 0; i < maxChunks; i++) {
      const result = await db
        .delete(schema.scans)
        .where(where)
        .limit(chunkSize)
        .returning({ id: schema.scans.id });
      affected += result.length;
      lastChunkFull = result.length === chunkSize;
      if (!lastChunkFull) break;
    }
    if (lastChunkFull) {
      const stillEligible = await hasRowsMatching(
        db.select({ n: count() }).from(schema.scans).where(where),
      );
      backlogRemaining = backlogRemaining || stillEligible;
    }
  }
  return { affected, wouldAffect, backlogRemaining, error: null };
}

/** Phase 11: audit_continuations are meant to live 60 minutes
 * (CONTINUATION_TTL_MINUTES, audit-continuation.ts) but nothing previously
 * deleted the row once it expired unconsumed — it just sat there until the
 * anonymous scan it referenced eventually aged past the 7-day anonymous
 * retention window, at which point purgeAnonymousScans's DELETE would hit
 * audit_continuations.scan_id's foreign key. Migration 0023 made that FK
 * ON DELETE CASCADE as a safety net, but this is the primary cleanup path:
 * purge the continuation itself, promptly, once it's genuinely unusable
 * (past its own expiry, never consumed) — well before its scan is anywhere
 * near its own retention cutoff. */
async function purgeExpiredAuditContinuations(
  db: Database,
  now: Date,
  dryRun: boolean,
  chunkSize: number,
  maxChunks: number,
): Promise<CategoryResult> {
  const where = and(
    isNull(schema.auditContinuations.consumedAt),
    lt(schema.auditContinuations.expiresAt, now.toISOString()),
  );

  if (dryRun) {
    const [row] = await db.select({ n: count() }).from(schema.auditContinuations).where(where);
    return { ...emptyCategoryResult(), wouldAffect: row?.n ?? 0 };
  }

  let affected = 0;
  let lastChunkFull = false;
  for (let i = 0; i < maxChunks; i++) {
    const result = await db
      .delete(schema.auditContinuations)
      .where(where)
      .limit(chunkSize)
      .returning({ id: schema.auditContinuations.id });
    affected += result.length;
    lastChunkFull = result.length === chunkSize;
    if (!lastChunkFull) break;
  }
  const backlogRemaining = lastChunkFull
    ? await hasRowsMatching(db.select({ n: count() }).from(schema.auditContinuations).where(where))
    : false;
  return { ...emptyCategoryResult(), affected, backlogRemaining };
}

/** Accounts past the cancellable grace period (lib/account.ts) are hard-deleted;
 * every owned row cascades away with them. Grace period is admin-tunable
 * (SRS §28.16), falling back to the documented 30-day default. Chunked by
 * selecting a bounded batch of overdue user ids rather than a single
 * unbounded IN-list delete, since each user's cascade fan-out (domains,
 * scans, sessions, etc.) makes this the most expensive per-row category. */
async function purgeDeletedAccounts(
  db: Database,
  now: Date,
  dryRun: boolean,
  chunkSize: number,
  maxChunks: number,
): Promise<CategoryResult> {
  const gracePeriodDays = await getIntConfig(
    db,
    "account_deletion_grace_period_days",
    ACCOUNT_DELETION_GRACE_PERIOD_DAYS,
  );
  const cutoff = daysAgo(gracePeriodDays, now);
  const where = and(
    eq(schema.users.status, "pending_deletion"),
    lt(schema.users.deletionRequestedAt, cutoff),
  );

  if (dryRun) {
    const [row] = await db.select({ n: count() }).from(schema.users).where(where);
    return { ...emptyCategoryResult(), wouldAffect: row?.n ?? 0 };
  }

  let affected = 0;
  let lastChunkFull = false;
  for (let i = 0; i < maxChunks; i++) {
    const overdue = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(where)
      .limit(chunkSize);
    if (overdue.length === 0) {
      lastChunkFull = false;
      break;
    }
    await db.delete(schema.users).where(
      inArray(
        schema.users.id,
        overdue.map((u) => u.id),
      ),
    );
    affected += overdue.length;
    lastChunkFull = overdue.length === chunkSize;
    if (!lastChunkFull) break;
  }
  const backlogRemaining = lastChunkFull
    ? await hasRowsMatching(db.select({ n: count() }).from(schema.users).where(where))
    : false;
  return { ...emptyCategoryResult(), affected, backlogRemaining };
}

/** SRS §28.5: a temporary entitlement always has an expiry — this is what
 * actually enforces it. Without this step, an expired grant would silently
 * keep a user on a paid plan forever, defeating the entire point of "always
 * requires an expiry date." Reverts to the plan the user's own real Paddle
 * subscription currently entitles them to (if any active one exists),
 * otherwise `free` — never blindly downgrades past a genuine paid
 * subscription that happens to coexist with an expiring temporary grant.
 * Not a DELETE — chunked by bounding how many entitlements are processed
 * per invocation, same backlog-remaining signal as the delete categories. */
async function revertExpiredEntitlements(
  db: Database,
  now: Date,
  dryRun: boolean,
  chunkSize: number,
  maxChunks: number,
): Promise<CategoryResult> {
  const where = and(
    isNull(schema.temporaryEntitlements.revokedAt),
    lt(schema.temporaryEntitlements.expiresAt, now.toISOString()),
  );

  if (dryRun) {
    const [row] = await db.select({ n: count() }).from(schema.temporaryEntitlements).where(where);
    return { ...emptyCategoryResult(), wouldAffect: row?.n ?? 0 };
  }

  const cap = chunkSize * maxChunks;
  const expired = await db
    .select({ id: schema.temporaryEntitlements.id, userId: schema.temporaryEntitlements.userId })
    .from(schema.temporaryEntitlements)
    .where(where)
    .limit(cap);

  for (const entitlement of expired) {
    await db
      .update(schema.temporaryEntitlements)
      .set({ revokedAt: now.toISOString() })
      .where(eq(schema.temporaryEntitlements.id, entitlement.id));

    const realPlanId = await resolveRealEntitledPlan(db, entitlement.userId);
    await db
      .update(schema.users)
      .set({ planId: realPlanId as never, updatedAt: now.toISOString() })
      .where(eq(schema.users.id, entitlement.userId));
  }
  const backlogRemaining =
    expired.length === cap
      ? await hasRowsMatching(
          db.select({ n: count() }).from(schema.temporaryEntitlements).where(where),
        )
      : false;
  return { ...emptyCategoryResult(), affected: expired.length, backlogRemaining };
}

/**
 * Phase 9 (RISK-010 closure): daily-cron orphan sweep for `AGENCY_LOGOS` R2
 * objects — the acceptance criteria the risk itself defined ("An
 * orphan-object sweep is added to the daily retention cron") rather than
 * adding cleanup to every individual revocation/deletion call site.
 * `bucket` is optional so existing callers/tests that don't set up an R2
 * binding keep working unchanged — the category is simply skipped (0
 * affected, no error) rather than the whole job failing when it's absent.
 */
async function purgeOrphanedAgencyLogos(
  db: Database,
  bucket: R2Bucket | undefined,
  dryRun: boolean,
): Promise<CategoryResult> {
  if (!bucket) return emptyCategoryResult();
  const result = await findAndCleanupOrphanedLogos(db, bucket, { dryRun });
  return {
    affected: result.orphansDeleted,
    wouldAffect: dryRun ? result.orphansFound.length : null,
    backlogRemaining: result.truncated,
    error: null,
  };
}

const CATEGORIES = [
  "expired_audit_continuations",
  "anonymous_scans",
  "domain_scans",
  "deleted_accounts",
  "expired_entitlements",
  "orphaned_agency_logos",
] as const;
type Category = (typeof CATEGORIES)[number];

export type DataRetentionResult = {
  // Flat fields preserved for existing callers/tests and the worker.ts log line.
  anonymousScansDeleted: number;
  domainScansDeleted: number;
  accountsPurged: number;
  entitlementsExpired: number;
  expiredContinuationsDeleted: number;
  orphanedAgencyLogosDeleted: number;
  dryRun: boolean;
  /** True if any category threw — the run still completed the categories that didn't fail. */
  hasErrors: boolean;
  /** True if any category hit its per-run chunk cap with real backlog still eligible. */
  hasBacklog: boolean;
  categories: Record<Category, CategoryResult>;
};

export type DataRetentionOptions = {
  /** When true, no data is modified — every category reports its real, exact `COUNT(*)`
   * (`wouldAffect`) instead. For admin/CLI verification before trusting a change to this job. */
  dryRun?: boolean;
  /** Overrides RETENTION_CHUNK_SIZE — exposed so tests can exercise the backlog-remaining path
   * without inserting tens of thousands of rows. Production callers should not need to set this. */
  chunkSize?: number;
  /** Overrides RETENTION_MAX_CHUNKS — same purpose as chunkSize above. */
  maxChunks?: number;
  /** The AGENCY_LOGOS R2 bucket — enables the orphaned_agency_logos category (Phase 9,
   * RISK-010). Omitted in most test harnesses; the category is then a no-op. */
  agencyLogosBucket?: R2Bucket;
};

export async function runDataRetentionPurge(
  db: Database,
  now: Date = new Date(),
  options: DataRetentionOptions = {},
): Promise<DataRetentionResult> {
  const dryRun = options.dryRun ?? false;
  const chunkSize = options.chunkSize ?? RETENTION_CHUNK_SIZE;
  const maxChunks = options.maxChunks ?? RETENTION_MAX_CHUNKS;

  // Continuations before scans: an unconsumed, expired continuation is
  // never useful once its scan is gone anyway, but purging it first keeps
  // the anonymous-scan purge below from ever needing the migration
  // 0023 CASCADE as anything but a safety net, not the primary mechanism.
  const runners: Record<Category, () => Promise<CategoryResult>> = {
    expired_audit_continuations: () =>
      purgeExpiredAuditContinuations(db, now, dryRun, chunkSize, maxChunks),
    anonymous_scans: () => purgeAnonymousScans(db, now, dryRun, chunkSize, maxChunks),
    domain_scans: () => purgeExpiredDomainScans(db, now, dryRun, chunkSize, maxChunks),
    deleted_accounts: () => purgeDeletedAccounts(db, now, dryRun, chunkSize, maxChunks),
    expired_entitlements: () => revertExpiredEntitlements(db, now, dryRun, chunkSize, maxChunks),
    orphaned_agency_logos: () => purgeOrphanedAgencyLogos(db, options.agencyLogosBucket, dryRun),
  };

  const categories = {} as Record<Category, CategoryResult>;
  for (const category of CATEGORIES) {
    try {
      categories[category] = await runners[category]();
    } catch (error) {
      categories[category] = {
        ...emptyCategoryResult(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    expiredContinuationsDeleted: categories.expired_audit_continuations.affected,
    anonymousScansDeleted: categories.anonymous_scans.affected,
    domainScansDeleted: categories.domain_scans.affected,
    accountsPurged: categories.deleted_accounts.affected,
    entitlementsExpired: categories.expired_entitlements.affected,
    orphanedAgencyLogosDeleted: categories.orphaned_agency_logos.affected,
    dryRun,
    hasErrors: CATEGORIES.some((c) => categories[c].error !== null),
    hasBacklog: CATEGORIES.some((c) => categories[c].backlogRemaining),
    categories,
  };
}
