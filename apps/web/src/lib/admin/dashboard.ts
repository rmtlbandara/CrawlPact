import { and, eq, gte, lt, sql } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { DateRange } from "./date-range";
import { getAdminEnvironment } from "./environment";

/**
 * SRS §28.2: the global dashboard. Split deliberately into two kinds of
 * numbers — see the comment above `snapshot` — since the SRS lists both
 * "current state" counts (total users, active subscriptions, ...) and
 * "flow" counts (new users, completed scans, revenue, ...) under one
 * heading without distinguishing them. Snapshot metrics are always as-of-now
 * regardless of the selected range; flow metrics are filtered to it.
 */
export async function getDashboardMetrics(db: Database, range: DateRange) {
  const { from, to } = range;

  const [
    totalUsers,
    suspendedUsers,
    payingCustomers,
    activeSubs,
    pastDueSubs,
    cancelledSubs,
    savedDomains,
    monitoredDomains,
    newUsers,
    activeUsers,
    completedScans,
    failedScans,
    criticalFindings,
    securityEvents,
    transactionsInRange,
    activeSubsForArr,
  ] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(schema.users),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.users)
      .where(eq(schema.users.status, "suspended")),
    db
      .select({ n: sql<number>`count(distinct ${schema.subscriptions.billingCustomerId})` })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.status, "active")),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.status, "active")),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.status, "past_due")),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.status, "cancelled")),
    db.select({ n: sql<number>`count(*)` }).from(schema.domains),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.domains)
      .where(eq(schema.domains.monitoringState, "active")),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.users)
      .where(and(gte(schema.users.createdAt, from), lt(schema.users.createdAt, to))),
    db
      .select({ n: sql<number>`count(distinct ${schema.sessions.userId})` })
      .from(schema.sessions)
      .where(and(gte(schema.sessions.lastSeenAt, from), lt(schema.sessions.lastSeenAt, to))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.scans)
      .where(
        and(
          gte(schema.scans.startedAt, from),
          lt(schema.scans.startedAt, to),
          sql`${schema.scans.status} in ('completed', 'completed_with_warnings')`,
        ),
      ),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.scans)
      .where(
        and(
          gte(schema.scans.startedAt, from),
          lt(schema.scans.startedAt, to),
          sql`${schema.scans.status} in ('incomplete', 'target_unavailable', 'blocked_for_safety', 'internal_failure')`,
        ),
      ),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.findings)
      .where(
        and(
          gte(schema.findings.createdAt, from),
          lt(schema.findings.createdAt, to),
          eq(schema.findings.severity, "critical"),
        ),
      ),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.securityEvents)
      .where(
        and(gte(schema.securityEvents.createdAt, from), lt(schema.securityEvents.createdAt, to)),
      ),
    db
      .select({
        currency: schema.transactions.currency,
        gross: sql<number>`coalesce(sum(${schema.transactions.grossAmountCents}), 0)`,
        refunds: sql<number>`coalesce(sum(case when ${schema.transactions.refundStatus} is not null then ${schema.transactions.grossAmountCents} else 0 end), 0)`,
        chargebacks: sql<number>`coalesce(sum(case when ${schema.transactions.chargebackStatus} is not null then 1 else 0 end), 0)`,
      })
      .from(schema.transactions)
      .where(and(gte(schema.transactions.occurredAt, from), lt(schema.transactions.occurredAt, to)))
      .groupBy(schema.transactions.currency),
    db
      .select({ annualPriceUsdCents: schema.plans.annualPriceUsdCents })
      .from(schema.subscriptions)
      .innerJoin(schema.plans, eq(schema.subscriptions.planId, schema.plans.id))
      .where(eq(schema.subscriptions.status, "active")),
  ]);

  const arrCents = activeSubsForArr.reduce((sum, r) => sum + r.annualPriceUsdCents, 0);

  return {
    environment: getAdminEnvironment(),
    snapshot: {
      totalUsers: totalUsers[0]?.n ?? 0,
      suspendedUsers: suspendedUsers[0]?.n ?? 0,
      payingCustomers: payingCustomers[0]?.n ?? 0,
      activeSubscriptions: activeSubs[0]?.n ?? 0,
      pastDueSubscriptions: pastDueSubs[0]?.n ?? 0,
      cancelledSubscriptions: cancelledSubs[0]?.n ?? 0,
      savedDomains: savedDomains[0]?.n ?? 0,
      monitoredDomains: monitoredDomains[0]?.n ?? 0,
      estimatedArrUsdCents: arrCents,
      estimatedMonthlyRecurringUsdCents: Math.round(arrCents / 12),
    },
    flow: {
      newUsers: newUsers[0]?.n ?? 0,
      activeUsers: activeUsers[0]?.n ?? 0,
      completedScans: completedScans[0]?.n ?? 0,
      failedScans: failedScans[0]?.n ?? 0,
      criticalFindings: criticalFindings[0]?.n ?? 0,
      securityEvents: securityEvents[0]?.n ?? 0,
      revenueByCurrency: transactionsInRange.map((r) => ({
        currency: r.currency,
        grossCents: r.gross,
        refundedCents: r.refunds,
        chargebackCount: r.chargebacks,
      })),
    },
  };
}

export type DashboardMetrics = Awaited<ReturnType<typeof getDashboardMetrics>>;
