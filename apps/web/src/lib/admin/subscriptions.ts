import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { getSubscription } from "../billing/paddle-api";
import { mapPriceIdToPlanId } from "../billing/plan-mapping";
import { PADDLE_TO_LOCAL_STATUS } from "../billing/webhook-processor";

export type SubscriptionFilters = {
  planId?: string;
  status?: string;
  pastDue?: boolean;
  cancelling?: boolean;
  mismatchOnly?: boolean;
  syncErrorOnly?: boolean;
  renewingBefore?: string;
};

/** SRS §28.5: subscriptions joined with owning user/billing customer, plus a
 * computed "entitlement mismatch" flag (local `users.plan_id` disagrees with
 * the subscription's own plan while it's active — the exact drift the
 * mission's resync action exists to fix). */
export async function listSubscriptions(db: Database, filters: SubscriptionFilters = {}) {
  const rows = await db
    .select({
      subscription: schema.subscriptions,
      billingCustomer: schema.billingCustomers,
      user: {
        id: schema.users.id,
        displayName: schema.users.displayName,
        planId: schema.users.planId,
      },
    })
    .from(schema.subscriptions)
    .innerJoin(
      schema.billingCustomers,
      eq(schema.subscriptions.billingCustomerId, schema.billingCustomers.id),
    )
    .innerJoin(schema.users, eq(schema.billingCustomers.userId, schema.users.id))
    .orderBy(desc(schema.subscriptions.updatedAt));

  return rows
    .map((row) => ({
      ...row,
      entitlementMismatch:
        row.subscription.status === "active" && row.subscription.planId !== row.user.planId,
      syncError: row.subscription.syncError,
    }))
    .filter((row) => {
      if (filters.planId && row.subscription.planId !== filters.planId) return false;
      if (filters.status && row.subscription.status !== filters.status) return false;
      if (filters.pastDue && row.subscription.status !== "past_due") return false;
      if (filters.cancelling && !row.subscription.cancelAtPeriodEnd) return false;
      if (filters.mismatchOnly && !row.entitlementMismatch) return false;
      if (filters.syncErrorOnly && !row.syncError) return false;
      if (
        filters.renewingBefore &&
        (!row.subscription.currentPeriodEnd ||
          row.subscription.currentPeriodEnd > filters.renewingBefore)
      ) {
        return false;
      }
      return true;
    });
}

export type ResyncResult = { ok: true } | { ok: false; message: string };

/** SRS §28.5 "Paddle resynchronisation": refetches live state from Paddle and
 * reconciles the local cache — a real API call, not a no-op, so it honestly
 * fails (recording the error in `syncError`) against this session's
 * unverified sandbox integration rather than pretending to succeed. */
export async function resyncSubscription(
  db: Database,
  env: {
    PADDLE_API_KEY: string;
    PADDLE_ENVIRONMENT: "sandbox" | "production";
    PADDLE_PRICE_ID_SOLO: string;
    PADDLE_PRICE_ID_PRO: string;
    PADDLE_PRICE_ID_AGENCY: string;
  },
  subscriptionId: string,
): Promise<ResyncResult> {
  const [sub] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.id, subscriptionId))
    .limit(1);
  if (!sub) return { ok: false, message: "Subscription not found." };

  const result = await getSubscription(env, sub.paddleSubscriptionId);
  const now = new Date().toISOString();

  if (!result.ok) {
    await db
      .update(schema.subscriptions)
      .set({ syncError: `${result.status}: ${result.message}`.slice(0, 500), updatedAt: now })
      .where(eq(schema.subscriptions.id, subscriptionId));
    return { ok: false, message: result.message || `Paddle returned HTTP ${result.status}.` };
  }

  const localStatus = PADDLE_TO_LOCAL_STATUS[result.status] ?? sub.status;
  const planId = result.priceId ? mapPriceIdToPlanId(env, result.priceId) : null;

  await db
    .update(schema.subscriptions)
    .set({
      status: localStatus,
      planId: planId ?? sub.planId,
      currentPeriodEnd: result.currentPeriodEnd ?? sub.currentPeriodEnd,
      syncError: null,
      updatedAt: now,
    })
    .where(eq(schema.subscriptions.id, subscriptionId));

  return { ok: true };
}

export type TransactionFilters = { userId?: string; status?: string };

/** SRS §28.6: transaction records for the revenue/finance view. Only fields
 * Paddle actually sends are shown — no fabricated fee/net figures. */
export async function listTransactions(db: Database, filters: TransactionFilters = {}) {
  const rows = await db
    .select({
      transaction: schema.transactions,
      billingCustomer: schema.billingCustomers,
      user: { id: schema.users.id, displayName: schema.users.displayName },
      subscription: { id: schema.subscriptions.id, planId: schema.subscriptions.planId },
    })
    .from(schema.transactions)
    .innerJoin(
      schema.billingCustomers,
      eq(schema.transactions.billingCustomerId, schema.billingCustomers.id),
    )
    .innerJoin(schema.users, eq(schema.billingCustomers.userId, schema.users.id))
    .leftJoin(schema.subscriptions, eq(schema.transactions.subscriptionId, schema.subscriptions.id))
    .orderBy(desc(schema.transactions.occurredAt));

  return rows.filter((row) => {
    if (filters.userId && row.user.id !== filters.userId) return false;
    if (filters.status && row.transaction.status !== filters.status) return false;
    return true;
  });
}

/** SRS §28.6 revenue-by-plan breakdown, supplementing the global dashboard's
 * currency totals with a plan-level split for the current calendar year. */
export async function getRevenueByPlan(db: Database) {
  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)).toISOString();
  return db
    .select({
      planId: schema.subscriptions.planId,
      currency: schema.transactions.currency,
      grossCents: sql<number>`coalesce(sum(${schema.transactions.grossAmountCents}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(schema.transactions)
    .innerJoin(
      schema.subscriptions,
      eq(schema.transactions.subscriptionId, schema.subscriptions.id),
    )
    .where(gte(schema.transactions.occurredAt, yearStart))
    .groupBy(schema.subscriptions.planId, schema.transactions.currency);
}

export async function listTemporaryEntitlements(db: Database) {
  return db
    .select({
      entitlement: schema.temporaryEntitlements,
      user: { id: schema.users.id, displayName: schema.users.displayName },
      grantedBy: { displayName: schema.users.displayName },
    })
    .from(schema.temporaryEntitlements)
    .innerJoin(schema.users, eq(schema.temporaryEntitlements.userId, schema.users.id))
    .orderBy(desc(schema.temporaryEntitlements.createdAt));
}

/** SRS §28.5: a temporary entitlement always has an expiry, a reason, is
 * audited (by the caller, via requireAdminAction), and is visibly labelled —
 * the label lives in `users.plan_id` staying unchanged; the *grant itself*
 * is what's labelled, in the Super Admin UI, as temporary/administrative. */
export async function grantTemporaryEntitlement(
  db: Database,
  params: {
    userId: string;
    grantedPlanId: string;
    reason: string;
    grantedByUserId: string;
    expiresAt: string;
  },
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.temporaryEntitlements).values({
    id,
    userId: params.userId,
    grantedPlanId: params.grantedPlanId as never,
    reason: params.reason,
    grantedByUserId: params.grantedByUserId,
    expiresAt: params.expiresAt,
    createdAt: now,
  });
  await db
    .update(schema.users)
    .set({ planId: params.grantedPlanId as never, updatedAt: now })
    .where(eq(schema.users.id, params.userId));
  return id;
}

/** The plan a user's own real Paddle subscription currently entitles them
 * to, ignoring any temporary entitlement override — `free` if none. Shared
 * by both immediate manual revocation (below) and the daily expiry sweep
 * (data-retention.ts) so early revocation and natural expiry behave
 * identically rather than one of them silently waiting for a cron tick. */
export async function resolveRealEntitledPlan(db: Database, userId: string): Promise<string> {
  const [realSub] = await db
    .select({ planId: schema.subscriptions.planId })
    .from(schema.subscriptions)
    .innerJoin(
      schema.billingCustomers,
      eq(schema.subscriptions.billingCustomerId, schema.billingCustomers.id),
    )
    .where(
      and(
        eq(schema.billingCustomers.userId, userId),
        sql`${schema.subscriptions.status} in ('active', 'trialing', 'past_due')`,
      ),
    )
    .limit(1);
  return realSub?.planId ?? "free";
}

export async function revokeTemporaryEntitlement(
  db: Database,
  entitlementId: string,
): Promise<void> {
  const [entitlement] = await db
    .select({ userId: schema.temporaryEntitlements.userId })
    .from(schema.temporaryEntitlements)
    .where(eq(schema.temporaryEntitlements.id, entitlementId))
    .limit(1);
  if (!entitlement) return;

  const now = new Date().toISOString();
  await db
    .update(schema.temporaryEntitlements)
    .set({ revokedAt: now })
    .where(
      and(
        eq(schema.temporaryEntitlements.id, entitlementId),
        isNull(schema.temporaryEntitlements.revokedAt),
      ),
    );
  const realPlanId = await resolveRealEntitledPlan(db, entitlement.userId);
  await db
    .update(schema.users)
    .set({ planId: realPlanId as never, updatedAt: now })
    .where(eq(schema.users.id, entitlement.userId));
}

/** Used by the data-retention/scheduler job to auto-expire, and by the
 * dashboard to flag entitlements past their mandatory expiry that are still
 * (incorrectly) in effect. */
export async function listExpiredActiveEntitlements(db: Database) {
  const now = new Date().toISOString();
  return db
    .select()
    .from(schema.temporaryEntitlements)
    .where(
      and(
        isNull(schema.temporaryEntitlements.revokedAt),
        lte(schema.temporaryEntitlements.expiresAt, now),
      ),
    );
}
