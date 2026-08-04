import { and, eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { getPlan } from "../plan";

/**
 * The single source of truth for plan marketing copy, entitlements, and Paddle pricing (Phase 6)
 * — replaces both the old file-constant `apps/web/src/lib/plans.ts` (marketing copy/entitlement
 * duplicate, annual-only, no Paddle IDs) and the old flat env-var mapping in
 * `apps/web/src/lib/billing/plan-mapping.ts` (one price ID per plan, no interval, no legacy
 * awareness). Entitlements are read through the existing `getPlan()` (unchanged, still the
 * single entitlement-gating chokepoint used by 13+ call sites) — this module only adds pricing
 * and marketing copy on top, it never re-derives or duplicates entitlement values.
 *
 * See docs/billing/APPROVED_PRICING_AND_ENTITLEMENT_MATRIX.md,
 * docs/product/AUDIT_CONVERSION_FLOW.md's sibling doc
 * docs/billing/CHECKOUT_CONTINUITY_ARCHITECTURE.md, and migration 0021_plan_prices.sql.
 */

export type PlanId = "free" | "solo" | "pro" | "agency";
export type PaidPlanId = "solo" | "pro" | "agency";
export type BillingInterval = "month" | "year";
export type PaddleEnvironment = "sandbox" | "production";

const PLAN_ORDER: PlanId[] = ["free", "solo", "pro", "agency"];

/** Marketing copy only — never an entitlement value. Entitlements always come from `getPlan()`. */
export const PLAN_COPY: Record<
  PlanId,
  { name: string; audience: string; cta: string; recommended: boolean }
> = {
  free: {
    name: "Free",
    audience: "For a one-time check on a single site.",
    cta: "Scan a website",
    recommended: false,
  },
  solo: {
    name: "Solo",
    audience: "For individual site owners tracking one project.",
    cta: "Start monitoring",
    recommended: false,
  },
  pro: {
    name: "Pro",
    audience: "For growing portfolios that need weekly monitoring.",
    cta: "Choose Pro",
    recommended: true,
  },
  agency: {
    name: "Agency",
    audience: "For agencies managing many client domains.",
    cta: "Choose Agency",
    recommended: false,
  },
};

export type PlanPriceOption = {
  paddlePriceId: string;
  paddleProductId: string;
  amountUsdCents: number;
};

export type PlanCatalogEntry = {
  id: PlanId;
  name: string;
  audience: string;
  cta: string;
  recommended: boolean;
  savedDomainLimit: number;
  monitoringFrequency: "none" | "monthly" | "weekly";
  historyRetentionDays: number;
  manualRescansPerDomainPerMonth: number;
  domainGroupsEnabled: boolean;
  csvExportEnabled: boolean;
  privateAtomFeedEnabled: boolean;
  batchImportLimit: number;
  agencyBrandingEnabled: boolean;
  /** null for Free — Free has no Paddle price at all, by design. */
  pricing: { month: PlanPriceOption; year: PlanPriceOption } | null;
};

async function activePriceRows(db: Database, environment: PaddleEnvironment, planId: PaidPlanId) {
  return db
    .select()
    .from(schema.planPrices)
    .where(
      and(
        eq(schema.planPrices.planId, planId),
        eq(schema.planPrices.environment, environment),
        eq(schema.planPrices.activeForNewCheckout, true),
      ),
    );
}

export async function getPlanCatalogEntry(
  db: Database,
  environment: PaddleEnvironment,
  planId: PlanId,
): Promise<PlanCatalogEntry> {
  const plan = await getPlan(db, planId);
  const copy = PLAN_COPY[planId];

  let pricing: PlanCatalogEntry["pricing"] = null;
  if (planId !== "free") {
    const rows = await activePriceRows(db, environment, planId);
    const month = rows.find((r) => r.interval === "month");
    const year = rows.find((r) => r.interval === "year");
    if (!month || !year) {
      throw new Error(
        `Missing active ${environment} price for plan "${planId}" (interval ${!month ? "month" : "year"}) — plan_prices is not fully seeded. Run pnpm paddle:catalog:verify.`,
      );
    }
    pricing = {
      month: {
        paddlePriceId: month.paddlePriceId,
        paddleProductId: month.paddleProductId,
        amountUsdCents: month.amountUsdCents,
      },
      year: {
        paddlePriceId: year.paddlePriceId,
        paddleProductId: year.paddleProductId,
        amountUsdCents: year.amountUsdCents,
      },
    };
  }

  return {
    id: planId,
    name: copy.name,
    audience: copy.audience,
    cta: copy.cta,
    recommended: copy.recommended,
    savedDomainLimit: plan.savedDomainLimit,
    monitoringFrequency: plan.monitoringFrequency,
    historyRetentionDays: plan.historyRetentionDays,
    manualRescansPerDomainPerMonth: plan.manualRescansPerDomainPerMonth,
    domainGroupsEnabled: plan.domainGroupsEnabled,
    csvExportEnabled: plan.csvExportEnabled,
    privateAtomFeedEnabled: plan.privateAtomFeedEnabled,
    batchImportLimit: plan.batchImportLimit,
    agencyBrandingEnabled: plan.agencyBrandingEnabled,
    pricing,
  };
}

/** Drives the public pricing page, the homepage pricing preview, and structured pricing data —
 * the one place all three read from, so they can never independently drift. */
export async function getPlanCatalog(
  db: Database,
  environment: PaddleEnvironment,
): Promise<PlanCatalogEntry[]> {
  return Promise.all(PLAN_ORDER.map((id) => getPlanCatalogEntry(db, environment, id)));
}

/**
 * Server-side checkout price resolution — the only place a (planId, interval) pair a visitor
 * picked becomes a real Paddle price ID. Never trust a price ID, product ID, or amount sent by
 * the browser (see docs/security/PHASE_06_BILLING_AND_CHECKOUT_THREAT_REVIEW.md). Returns null
 * for any plan/interval/environment combination without an active-for-new-checkout row —
 * callers must treat that as a rejection, never fall back to a legacy or cross-environment price.
 */
export async function resolveCheckoutPrice(
  db: Database,
  environment: PaddleEnvironment,
  planId: PaidPlanId,
  interval: BillingInterval,
): Promise<PlanPriceOption | null> {
  const [row] = await db
    .select()
    .from(schema.planPrices)
    .where(
      and(
        eq(schema.planPrices.planId, planId),
        eq(schema.planPrices.environment, environment),
        eq(schema.planPrices.interval, interval),
        eq(schema.planPrices.activeForNewCheckout, true),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    paddlePriceId: row.paddlePriceId,
    paddleProductId: row.paddleProductId,
    amountUsdCents: row.amountUsdCents,
  };
}

export type ResolvedPrice = {
  planId: PaidPlanId;
  interval: BillingInterval;
  legacy: boolean;
  environment: PaddleEnvironment;
};

/**
 * Webhook-side price→plan resolution — replaces `plan-mapping.ts`'s `mapPriceIdToPlanId`.
 * Deliberately resolves **any** known price (legacy included), not just prices currently active
 * for new checkout — an existing subscriber's webhook events must keep resolving to a plan
 * forever, long after their price stops being offered to new purchases. See
 * docs/billing/LEGACY_PRICE_AND_SUBSCRIBER_POLICY.md.
 */
export async function resolvePriceToPlan(
  db: Database,
  paddlePriceId: string,
): Promise<ResolvedPrice | null> {
  const [row] = await db
    .select()
    .from(schema.planPrices)
    .where(eq(schema.planPrices.paddlePriceId, paddlePriceId))
    .limit(1);
  if (!row) return null;
  return {
    planId: row.planId as PaidPlanId,
    interval: row.interval,
    legacy: row.legacy,
    environment: row.environment,
  };
}
