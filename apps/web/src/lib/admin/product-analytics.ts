import { and, eq, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

/**
 * Phase 13 Super Admin product-measurement dashboard
 * (docs/analytics/CRAWLPACT_PRODUCT_MEASUREMENT_STRATEGY.md). Every number
 * here is a real, bounded D1 query against `product_events` and
 * authoritative billing/domain state — never a fabricated or extrapolated
 * value (see CLAUDE.md's "never present mocked data as a real outcome"
 * rule, and this codebase's Phase 11 precedent in `admin/capacity.ts`).
 *
 * "Meaningful product action" for WAU/MAU/engagement purposes is any row in
 * `product_events` with a non-null `userId` — every existing call site
 * (see `docs/analytics/PRODUCT_EVENT_REGISTRY.md`) is a real, human-
 * triggered request handler, never cron/webhook/automated-scan code, so no
 * separate "is this automated" filter is needed on top of that.
 */

export type DateRangeDays = 7 | 30 | 90 | 365;

function rangeStartIso(rangeDays: DateRangeDays, now: Date): string {
  return new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000).toISOString();
}

async function eventCountInRange(
  db: Database,
  eventName: string,
  sinceIso: string,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.productEvents)
    .where(
      and(
        eq(schema.productEvents.eventName, eventName),
        gte(schema.productEvents.createdAt, sinceIso),
      ),
    );
  return Number(row?.n ?? 0);
}

async function distinctUsersInRange(db: Database, sinceIso: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(distinct ${schema.productEvents.userId})` })
    .from(schema.productEvents)
    .where(
      and(isNotNull(schema.productEvents.userId), gte(schema.productEvents.createdAt, sinceIso)),
    );
  return Number(row?.n ?? 0);
}

/** Present as "N / D — P%", never a bare percentage — see the dashboard's
 * own low-volume-data handling rule (docs/analytics/PRODUCT_METRIC_DICTIONARY.md).
 * Reused by admin/pilot-analytics.ts for the same reason (Phase 17). */
export type RatioMetric = { numerator: number; denominator: number; percent: number | null };

export function ratio(numerator: number, denominator: number): RatioMetric {
  return {
    numerator,
    denominator,
    percent: denominator === 0 ? null : Math.round((numerator / denominator) * 1000) / 10,
  };
}

export type ProductAnalyticsSnapshot = {
  rangeDays: DateRangeDays;
  executiveSummary: {
    totalAccounts: number;
    activatedAccounts: number;
    activePaidAccounts: number;
    monitoredDomains: number;
    wau: number;
    mau: number;
    auditToSavedDomainConversion: RatioMetric;
  };
  acquisition: {
    landingViewedInRange: number;
    auditStartedInRange: number;
    pricingViewedInRange: number;
  };
  auditFunnel: {
    auditStarted: number;
    auditCompleted: number;
    resultViewed: number;
    accountCreated: number;
    domainSaved: number;
    completionRate: RatioMetric;
    resultViewRate: RatioMetric;
    resultToSignupRate: RatioMetric;
    signupToSavedDomainRate: RatioMetric;
  };
  activation: {
    accountsWithBaseline: RatioMetric;
    accountsWithMonitoringEnabled: RatioMetric;
  };
  engagement: {
    domainOpened: number;
    timelineViewed: number;
    rescanUsed: number;
    reportShared: number;
  };
  /** Simplified proxy, not full cohort day-N retention — see
   * docs/analytics/PRODUCT_METRIC_DICTIONARY.md "Retention (simplified)". */
  retention: {
    activatedInRange: number;
    stillActiveInRange: RatioMetric;
  };
  conversion: {
    pricingViewed: number;
    planSelected: number;
    checkoutOpened: number;
    subscriptionActivated: number;
  };
  revenue: {
    /** Authoritative from `subscriptions.status`, never inferred from GA. */
    activeSubscriptionsByPlan: Record<string, number>;
    estimatedMrrUsdCents: number;
  };
  agency: {
    agencyPlanAccounts: number;
    accountsUsingGroups: number;
    accountsUsingCsvImport: number;
    accountsUsingCsvExport: number;
    accountsWithAgencyBranding: number;
  };
  measurementHealth: {
    lastEventAt: string | null;
    eventsLast24h: number;
    consentGrantedLast30d: number;
    consentDeclinedLast30d: number;
  };
};

export async function getProductAnalyticsSnapshot(
  db: Database,
  rangeDays: DateRangeDays = 30,
  now: Date = new Date(),
): Promise<ProductAnalyticsSnapshot> {
  const sinceIso = rangeStartIso(rangeDays, now);
  const day1Iso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const day7Iso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const day30Iso = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalAccountsRow,
    activatedAccountsRow,
    activePaidAccountsRow,
    monitoredDomainsRow,
    wau,
    mau,
    landingViewedInRange,
    auditStartedInRange,
    pricingViewedInRange,
    auditStarted,
    auditCompleted,
    resultViewed,
    accountCreated,
    domainSaved,
    accountsWithBaselineRow,
    accountsWithMonitoringRow,
    domainOpened,
    timelineViewed,
    rescanUsed,
    reportShared,
    activatedInRangeRow,
    stillActiveInRangeRow,
    pricingViewed,
    planSelected,
    checkoutOpened,
    subscriptionActivated,
    activeSubsByPlanRows,
    agencyPlanAccountsRow,
    accountsUsingGroupsRow,
    accountsUsingCsvImportRow,
    accountsUsingCsvExportRow,
    accountsWithAgencyBrandingRow,
    lastEventRow,
    eventsLast24hRow,
    consentGrantedRow,
    consentDeclinedRow,
  ] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.users)
      .where(isNull(schema.users.deletedAt)),
    db
      .select({ n: sql<number>`count(distinct ${schema.domains.ownerUserId})` })
      .from(schema.domains)
      .where(and(isNotNull(schema.domains.lastScanId), isNull(schema.domains.deletedAt))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.subscriptions)
      .where(inArray(schema.subscriptions.status, ["active", "trialing"])),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.domains)
      .where(and(eq(schema.domains.monitoringState, "active"), isNull(schema.domains.deletedAt))),
    distinctUsersInRange(db, day7Iso),
    distinctUsersInRange(db, day30Iso),
    eventCountInRange(db, "landing_viewed", sinceIso),
    eventCountInRange(db, "audit_started", sinceIso),
    eventCountInRange(db, "pricing_viewed", sinceIso),
    eventCountInRange(db, "audit_started", sinceIso),
    eventCountInRange(db, "audit_completed", sinceIso),
    eventCountInRange(db, "result_viewed", sinceIso),
    eventCountInRange(db, "account_created", sinceIso),
    eventCountInRange(db, "domain_saved", sinceIso),
    db
      .select({ n: sql<number>`count(distinct ${schema.domains.ownerUserId})` })
      .from(schema.domains)
      .where(and(isNotNull(schema.domains.lastScanId), isNull(schema.domains.deletedAt))),
    db
      .select({ n: sql<number>`count(distinct ${schema.domains.ownerUserId})` })
      .from(schema.domains)
      .where(and(eq(schema.domains.monitoringState, "active"), isNull(schema.domains.deletedAt))),
    eventCountInRange(db, "saved_domain_opened", sinceIso),
    eventCountInRange(db, "domain_timeline_viewed", sinceIso),
    eventCountInRange(db, "domain_rescan_started", sinceIso),
    eventCountInRange(db, "report_shared", sinceIso),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.users)
      .where(and(gte(schema.users.createdAt, sinceIso), isNull(schema.users.deletedAt))),
    db
      .select({ n: sql<number>`count(distinct ${schema.productEvents.userId})` })
      .from(schema.productEvents)
      .innerJoin(schema.users, eq(schema.productEvents.userId, schema.users.id))
      .where(
        and(gte(schema.users.createdAt, sinceIso), gte(schema.productEvents.createdAt, day30Iso)),
      ),
    eventCountInRange(db, "pricing_viewed", sinceIso),
    eventCountInRange(db, "plan_selected", sinceIso),
    eventCountInRange(db, "checkout_opened", sinceIso),
    eventCountInRange(db, "subscription_activated", sinceIso),
    db
      .select({ planId: schema.subscriptions.planId, n: sql<number>`count(*)` })
      .from(schema.subscriptions)
      .where(inArray(schema.subscriptions.status, ["active", "trialing"]))
      .groupBy(schema.subscriptions.planId),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.users)
      .where(and(eq(schema.users.planId, "agency"), isNull(schema.users.deletedAt))),
    db
      .select({ n: sql<number>`count(distinct ${schema.domains.ownerUserId})` })
      .from(schema.domains)
      .where(and(isNotNull(schema.domains.groupId), isNull(schema.domains.deletedAt))),
    db
      .select({ n: sql<number>`count(distinct ${schema.portfolioImportJobs.ownerUserId})` })
      .from(schema.portfolioImportJobs),
    db
      .select({ n: sql<number>`count(distinct ${schema.productEvents.userId})` })
      .from(schema.productEvents)
      .where(eq(schema.productEvents.eventName, "portfolio_export_completed")),
    db.select({ n: sql<number>`count(*)` }).from(schema.agencyBrandProfiles),
    db
      .select({ createdAt: schema.productEvents.createdAt })
      .from(schema.productEvents)
      .orderBy(sql`${schema.productEvents.createdAt} desc`)
      .limit(1),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.productEvents)
      .where(gte(schema.productEvents.createdAt, day1Iso)),
    eventCountInRange(db, "analytics_consent_granted", day30Iso),
    eventCountInRange(db, "analytics_consent_declined", day30Iso),
  ]);

  const totalAccounts = Number(totalAccountsRow[0]?.n ?? 0);
  const activatedAccounts = Number(activatedAccountsRow[0]?.n ?? 0);
  const accountsWithMonitoring = Number(accountsWithMonitoringRow[0]?.n ?? 0);

  const activeSubscriptionsByPlan: Record<string, number> = {};
  let estimatedMrrUsdCents = 0;
  const planAnnualPrices = await db
    .select({ id: schema.plans.id, annualPriceUsdCents: schema.plans.annualPriceUsdCents })
    .from(schema.plans);
  const annualByPlan: Record<string, number> = {};
  for (const p of planAnnualPrices) annualByPlan[p.id] = p.annualPriceUsdCents;
  for (const row of activeSubsByPlanRows) {
    activeSubscriptionsByPlan[row.planId] = Number(row.n);
    const annual = annualByPlan[row.planId] ?? 0;
    estimatedMrrUsdCents += Math.round((annual / 12) * Number(row.n));
  }

  return {
    rangeDays,
    executiveSummary: {
      totalAccounts,
      activatedAccounts,
      activePaidAccounts: Number(activePaidAccountsRow[0]?.n ?? 0),
      monitoredDomains: Number(monitoredDomainsRow[0]?.n ?? 0),
      wau,
      mau,
      auditToSavedDomainConversion: ratio(domainSaved, auditStarted),
    },
    acquisition: {
      landingViewedInRange,
      auditStartedInRange,
      pricingViewedInRange,
    },
    auditFunnel: {
      auditStarted,
      auditCompleted,
      resultViewed,
      accountCreated,
      domainSaved,
      completionRate: ratio(auditCompleted, auditStarted),
      resultViewRate: ratio(resultViewed, auditCompleted),
      resultToSignupRate: ratio(accountCreated, resultViewed),
      signupToSavedDomainRate: ratio(domainSaved, accountCreated),
    },
    activation: {
      accountsWithBaseline: ratio(Number(accountsWithBaselineRow[0]?.n ?? 0), totalAccounts),
      accountsWithMonitoringEnabled: ratio(accountsWithMonitoring, activatedAccounts),
    },
    engagement: {
      domainOpened,
      timelineViewed,
      rescanUsed,
      reportShared,
    },
    retention: {
      activatedInRange: Number(activatedInRangeRow[0]?.n ?? 0),
      stillActiveInRange: ratio(
        Number(stillActiveInRangeRow[0]?.n ?? 0),
        Number(activatedInRangeRow[0]?.n ?? 0),
      ),
    },
    conversion: {
      pricingViewed,
      planSelected,
      checkoutOpened,
      subscriptionActivated,
    },
    revenue: {
      activeSubscriptionsByPlan,
      estimatedMrrUsdCents,
    },
    agency: {
      agencyPlanAccounts: Number(agencyPlanAccountsRow[0]?.n ?? 0),
      accountsUsingGroups: Number(accountsUsingGroupsRow[0]?.n ?? 0),
      accountsUsingCsvImport: Number(accountsUsingCsvImportRow[0]?.n ?? 0),
      accountsUsingCsvExport: Number(accountsUsingCsvExportRow[0]?.n ?? 0),
      accountsWithAgencyBranding: Number(accountsWithAgencyBrandingRow[0]?.n ?? 0),
    },
    measurementHealth: {
      lastEventAt: lastEventRow[0]?.createdAt ?? null,
      eventsLast24h: Number(eventsLast24hRow[0]?.n ?? 0),
      consentGrantedLast30d: consentGrantedRow,
      consentDeclinedLast30d: consentDeclinedRow,
    },
  };
}
