import { eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { PaidPlanId, BillingInterval, PaddleEnvironment } from "./plan-catalog";
import { resolveCheckoutPrice } from "./plan-catalog";
import { previewSubscriptionUpdate, updateSubscriptionItem } from "./paddle-api";

/**
 * Upgrade/downgrade/billing-cycle-change policy (fixes RISK-017 — the old UI labelled every
 * non-current plan "Upgrade to X" regardless of direction). See
 * docs/billing/PLAN_CHANGE_AND_PRORATION_POLICY.md for the full rationale.
 *
 * Direction is decided by comparing (plan rank, interval weight) as a single ordered pair, which
 * uniformly covers all four required cases from one rule:
 *   - Solo → Pro (higher plan rank): immediate.
 *   - Pro → Solo (lower plan rank): scheduled.
 *   - Solo monthly → Solo yearly (same plan, more commitment): immediate.
 *   - Solo yearly → Solo monthly (same plan, less commitment): scheduled.
 */
const PLAN_RANK: Record<PaidPlanId, number> = { solo: 1, pro: 2, agency: 3 };
const INTERVAL_WEIGHT: Record<BillingInterval, number> = { month: 0, year: 1 };

export type PlanChangeDirection = "immediate" | "scheduled";

export function planChangeDirection(
  current: { planId: PaidPlanId; interval: BillingInterval },
  target: { planId: PaidPlanId; interval: BillingInterval },
): PlanChangeDirection {
  const currentRank = PLAN_RANK[current.planId] * 10 + INTERVAL_WEIGHT[current.interval];
  const targetRank = PLAN_RANK[target.planId] * 10 + INTERVAL_WEIGHT[target.interval];
  return targetRank > currentRank ? "immediate" : "scheduled";
}

export type ActiveSubscriptionContext = {
  subscriptionRowId: string;
  paddleSubscriptionId: string;
  currentPlanId: PaidPlanId;
  currentInterval: BillingInterval;
  currentPeriodEnd: string | null;
};

/** Loads the caller's own active/trialing/past_due paid subscription, or null if they don't have
 * one — every plan-change action requires an existing subscription to change (a Free user with
 * no subscription uses the ordinary new-purchase checkout instead, never this path). */
export async function getActiveSubscriptionContext(
  db: Database,
  userId: string,
): Promise<ActiveSubscriptionContext | null> {
  const [billingCustomer] = await db
    .select()
    .from(schema.billingCustomers)
    .where(eq(schema.billingCustomers.userId, userId))
    .limit(1);
  if (!billingCustomer) return null;

  const [subscription] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.billingCustomerId, billingCustomer.id))
    .limit(1);
  if (!subscription) return null;
  if (!["active", "trialing", "past_due"].includes(subscription.status)) return null;
  if (!subscription.billingInterval || subscription.planId === "free") return null;

  return {
    subscriptionRowId: subscription.id,
    paddleSubscriptionId: subscription.paddleSubscriptionId,
    currentPlanId: subscription.planId as PaidPlanId,
    currentInterval: subscription.billingInterval,
    currentPeriodEnd: subscription.currentPeriodEnd,
  };
}

export type PlanChangePreviewResult =
  | {
      ok: true;
      direction: PlanChangeDirection;
      currencyCode: string;
      immediateTotalCents: number | null;
      effectiveDate: string | null;
    }
  | { ok: false; reason: "same_plan" | "price_unavailable" | "paddle_api_error"; message: string };

export async function previewPlanChange(
  db: Database,
  env: { PADDLE_API_KEY: string; PADDLE_ENVIRONMENT: PaddleEnvironment },
  context: ActiveSubscriptionContext,
  targetPlanId: PaidPlanId,
  targetInterval: BillingInterval,
): Promise<PlanChangePreviewResult> {
  if (targetPlanId === context.currentPlanId && targetInterval === context.currentInterval) {
    return { ok: false, reason: "same_plan", message: "This is already your current plan." };
  }

  const targetPrice = await resolveCheckoutPrice(
    db,
    env.PADDLE_ENVIRONMENT,
    targetPlanId,
    targetInterval,
  );
  if (!targetPrice) {
    return {
      ok: false,
      reason: "price_unavailable",
      message: "This plan is not currently available.",
    };
  }

  const direction = planChangeDirection(
    { planId: context.currentPlanId, interval: context.currentInterval },
    { planId: targetPlanId, interval: targetInterval },
  );

  if (direction === "scheduled") {
    // Never billed until the effective date — no proration preview needed, the current price
    // continues unchanged until then.
    return {
      ok: true,
      direction,
      currencyCode: "USD",
      immediateTotalCents: null,
      effectiveDate: context.currentPeriodEnd,
    };
  }

  const preview = await previewSubscriptionUpdate(
    env,
    context.paddleSubscriptionId,
    targetPrice.paddlePriceId,
  );
  if (!preview.ok) {
    return {
      ok: false,
      reason: "paddle_api_error",
      message: preview.message || `Paddle returned HTTP ${preview.status}.`,
    };
  }

  return {
    ok: true,
    direction,
    currencyCode: preview.currencyCode,
    immediateTotalCents: preview.immediateTotalCents,
    effectiveDate: preview.nextBilledAt,
  };
}

export type PlanChangeConfirmResult =
  | { ok: true; direction: PlanChangeDirection; effectiveDate: string | null }
  | { ok: false; reason: "same_plan" | "price_unavailable" | "paddle_api_error"; message: string };

/**
 * Applies the change. Immediate (upgrade / more-commitment interval change): calls Paddle now;
 * `users.plan_id` is deliberately NOT touched here — only the subsequent `subscription.updated`
 * webhook grants the new entitlement (see apps/web/src/pages/api/billing/AGENTS.md). Scheduled
 * (downgrade / less-commitment interval change): never calls Paddle at all yet — only records the
 * intent locally, so current entitlements are preserved automatically until the effective date
 * (see docs/billing/PLAN_CHANGE_AND_PRORATION_POLICY.md); a scheduled sweep applies it later.
 */
export async function confirmPlanChange(
  db: Database,
  env: { PADDLE_API_KEY: string; PADDLE_ENVIRONMENT: PaddleEnvironment },
  context: ActiveSubscriptionContext,
  targetPlanId: PaidPlanId,
  targetInterval: BillingInterval,
): Promise<PlanChangeConfirmResult> {
  if (targetPlanId === context.currentPlanId && targetInterval === context.currentInterval) {
    return { ok: false, reason: "same_plan", message: "This is already your current plan." };
  }

  const targetPrice = await resolveCheckoutPrice(
    db,
    env.PADDLE_ENVIRONMENT,
    targetPlanId,
    targetInterval,
  );
  if (!targetPrice) {
    return {
      ok: false,
      reason: "price_unavailable",
      message: "This plan is not currently available.",
    };
  }

  const direction = planChangeDirection(
    { planId: context.currentPlanId, interval: context.currentInterval },
    { planId: targetPlanId, interval: targetInterval },
  );

  if (direction === "scheduled") {
    await db
      .update(schema.subscriptions)
      .set({
        scheduledPlanId: targetPlanId,
        scheduledPaddlePriceId: targetPrice.paddlePriceId,
        scheduledChangeEffectiveAt: context.currentPeriodEnd,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.subscriptions.id, context.subscriptionRowId));
    return { ok: true, direction, effectiveDate: context.currentPeriodEnd };
  }

  const result = await updateSubscriptionItem(
    env,
    context.paddleSubscriptionId,
    targetPrice.paddlePriceId,
    "prorated_immediately",
  );
  if (!result.ok) {
    return {
      ok: false,
      reason: "paddle_api_error",
      message: result.message || `Paddle returned HTTP ${result.status}.`,
    };
  }

  // Clear any previously scheduled (now superseded) change, so the UI never shows a stale
  // "scheduled to change to X" alongside a just-applied immediate change.
  await db
    .update(schema.subscriptions)
    .set({
      scheduledPlanId: null,
      scheduledPaddlePriceId: null,
      scheduledChangeEffectiveAt: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.subscriptions.id, context.subscriptionRowId));

  return { ok: true, direction, effectiveDate: null };
}

/** Cancels a scheduled (not-yet-applied) downgrade — the customer changed their mind before the
 * effective date. Purely local; nothing was ever sent to Paddle for a scheduled change, so there
 * is nothing to undo there either. */
export async function cancelScheduledPlanChange(
  db: Database,
  subscriptionRowId: string,
): Promise<void> {
  await db
    .update(schema.subscriptions)
    .set({
      scheduledPlanId: null,
      scheduledPaddlePriceId: null,
      scheduledChangeEffectiveAt: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.subscriptions.id, subscriptionRowId));
}
