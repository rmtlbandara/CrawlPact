import { and, eq, inArray, isNotNull, isNull, lt, notInArray } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { ACCOUNT_DELETION_GRACE_PERIOD_DAYS } from "./account";
import { resolveRealEntitledPlan } from "./admin/subscriptions";
import { getIntConfig } from "./runtime-config";

/**
 * Data retention purge (docs/data/DATA_RETENTION.md, SRS §34, Part 2 Step
 * 19). Runs daily from the same cron as the monitoring sweep
 * (worker.ts). Cascade-delete FKs (see every `ON DELETE CASCADE` in the
 * migrations) do the bulk of the work once the "root" row — a scan or a
 * user — is removed, so this stays a short list of targeted deletes
 * rather than needing to touch every table by hand.
 */

const ANONYMOUS_SCAN_RETENTION_DAYS = 7;

function daysAgo(days: number, now: Date): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** Anonymous (unowned) scans: 24h–7d per the retention table — purged after 7 days
 * by default, admin-tunable via runtime_configuration (SRS §28.16). */
async function purgeAnonymousScans(db: Database, now: Date): Promise<number> {
  const retentionDays = await getIntConfig(
    db,
    "anonymous_scan_retention_days",
    ANONYMOUS_SCAN_RETENTION_DAYS,
  );
  const cutoff = daysAgo(retentionDays, now);
  const result = await db
    .delete(schema.scans)
    .where(and(isNull(schema.scans.domainId), lt(schema.scans.startedAt, cutoff)))
    .returning({ id: schema.scans.id });
  return result.length;
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
 * actually had anything to purge. One bulk DELETE per plan does the same
 * work in a bounded number of statements.
 */
async function purgeExpiredDomainScans(db: Database, now: Date): Promise<number> {
  const plans = await db
    .select({ id: schema.plans.id, retentionDays: schema.plans.historyRetentionDays })
    .from(schema.plans);

  const keptBaselines = db
    .select({ id: schema.domains.lastScanId })
    .from(schema.domains)
    .where(isNotNull(schema.domains.lastScanId));

  let deleted = 0;
  for (const plan of plans) {
    const cutoff = daysAgo(plan.retentionDays, now);
    const domainIdsOnPlan = db
      .select({ id: schema.domains.id })
      .from(schema.domains)
      .innerJoin(schema.users, eq(schema.domains.ownerUserId, schema.users.id))
      .where(eq(schema.users.planId, plan.id));

    const result = await db
      .delete(schema.scans)
      .where(
        and(
          inArray(schema.scans.domainId, domainIdsOnPlan),
          lt(schema.scans.startedAt, cutoff),
          notInArray(schema.scans.id, keptBaselines),
        ),
      )
      .returning({ id: schema.scans.id });
    deleted += result.length;
  }
  return deleted;
}

/** Accounts past the cancellable grace period (lib/account.ts) are hard-deleted;
 * every owned row cascades away with them. Grace period is admin-tunable
 * (SRS §28.16), falling back to the documented 30-day default. */
async function purgeDeletedAccounts(db: Database, now: Date): Promise<number> {
  const gracePeriodDays = await getIntConfig(
    db,
    "account_deletion_grace_period_days",
    ACCOUNT_DELETION_GRACE_PERIOD_DAYS,
  );
  const cutoff = daysAgo(gracePeriodDays, now);
  const overdue = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.status, "pending_deletion"),
        lt(schema.users.deletionRequestedAt, cutoff),
      ),
    );

  if (overdue.length === 0) return 0;
  const ids = overdue.map((u) => u.id);
  await db.delete(schema.users).where(inArray(schema.users.id, ids));
  return ids.length;
}

/** SRS §28.5: a temporary entitlement always has an expiry — this is what
 * actually enforces it. Without this step, an expired grant would silently
 * keep a user on a paid plan forever, defeating the entire point of "always
 * requires an expiry date." Reverts to the plan the user's own real Paddle
 * subscription currently entitles them to (if any active one exists),
 * otherwise `free` — never blindly downgrades past a genuine paid
 * subscription that happens to coexist with an expiring temporary grant. */
async function revertExpiredEntitlements(db: Database, now: Date): Promise<number> {
  const expired = await db
    .select({ id: schema.temporaryEntitlements.id, userId: schema.temporaryEntitlements.userId })
    .from(schema.temporaryEntitlements)
    .where(
      and(
        isNull(schema.temporaryEntitlements.revokedAt),
        lt(schema.temporaryEntitlements.expiresAt, now.toISOString()),
      ),
    );

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
  return expired.length;
}

export type DataRetentionResult = {
  anonymousScansDeleted: number;
  domainScansDeleted: number;
  accountsPurged: number;
  entitlementsExpired: number;
};

export async function runDataRetentionPurge(
  db: Database,
  now: Date = new Date(),
): Promise<DataRetentionResult> {
  const anonymousScansDeleted = await purgeAnonymousScans(db, now);
  const domainScansDeleted = await purgeExpiredDomainScans(db, now);
  const accountsPurged = await purgeDeletedAccounts(db, now);
  const entitlementsExpired = await revertExpiredEntitlements(db, now);
  return { anonymousScansDeleted, domainScansDeleted, accountsPurged, entitlementsExpired };
}
