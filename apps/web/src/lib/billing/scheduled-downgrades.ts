import { and, eq, isNotNull, lte } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { updateSubscriptionItem } from "./paddle-api";

export type ScheduledDowngradeSweepResult = { applied: number; failed: number };

/**
 * Applies every scheduled plan change (downgrade, or a yearly→monthly billing-cycle change)
 * whose effective date has arrived — see docs/billing/PLAN_CHANGE_AND_PRORATION_POLICY.md. Only
 * ever calls Paddle at (or after) the effective date, never earlier — that's the entire
 * mechanism that keeps current entitlements intact until then, with no separate gating logic
 * required elsewhere. `proration_billing_mode: "do_not_bill"` because the customer already paid
 * in full for the period that just ended; this transition must never generate a second charge.
 *
 * Per apps/web/src/pages/api/billing/AGENTS.md, this never writes the new plan onto
 * `users`/`subscriptions` itself — only submits the change to Paddle and clears the local
 * "scheduled" markers once submitted. The actual entitlement grant still only ever happens via
 * the `subscription.updated` webhook Paddle sends back, through the normal
 * compare-and-swap-protected path in webhook-processor.ts.
 */
export async function applyDueScheduledDowngrades(
  db: Database,
  env: { PADDLE_API_KEY: string; PADDLE_ENVIRONMENT: "sandbox" | "production" },
): Promise<ScheduledDowngradeSweepResult> {
  const now = new Date().toISOString();
  const due = await db
    .select()
    .from(schema.subscriptions)
    .where(
      and(
        isNotNull(schema.subscriptions.scheduledChangeEffectiveAt),
        lte(schema.subscriptions.scheduledChangeEffectiveAt, now),
      ),
    );

  let applied = 0;
  let failed = 0;
  for (const sub of due) {
    if (!sub.scheduledPaddlePriceId) continue;
    const result = await updateSubscriptionItem(
      env,
      sub.paddleSubscriptionId,
      sub.scheduledPaddlePriceId,
      "do_not_bill",
    );
    if (!result.ok) {
      failed += 1;
      continue;
    }
    await db
      .update(schema.subscriptions)
      .set({
        scheduledPlanId: null,
        scheduledPaddlePriceId: null,
        scheduledChangeEffectiveAt: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.subscriptions.id, sub.id));
    applied += 1;
  }

  return { applied, failed };
}
