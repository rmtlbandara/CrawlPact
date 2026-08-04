# Plan-change and proration policy

Fixes RISK-017: the pre-Phase-6 billing page labelled every non-current plan "Upgrade to X"
regardless of actual direction, including genuine downgrades. Implemented in
`apps/web/src/lib/billing/plan-change.ts`.

## Direction rule

A single ordered-pair comparison decides immediate vs. scheduled, covering plan changes and
billing-cycle changes with one rule instead of two separate ones:

```ts
const PLAN_RANK = { solo: 1, pro: 2, agency: 3 };
const INTERVAL_WEIGHT = { month: 0, year: 1 };

rank(x) = PLAN_RANK[x.planId] * 10 + INTERVAL_WEIGHT[x.interval];
direction = rank(target) > rank(current) ? "immediate" : "scheduled";
```

This reduces to all four required cases from one formula:

| From    | To      | rank(from) | rank(to) | Direction |
| ------- | ------- | ---------- | -------- | --------- |
| Solo/mo | Pro/mo  | 10         | 20       | immediate |
| Pro/mo  | Solo/mo | 20         | 10       | scheduled |
| Solo/mo | Solo/yr | 10         | 11       | immediate |
| Solo/yr | Solo/mo | 11         | 10       | scheduled |

A same-plan, same-interval "change" is rejected upstream as `same_plan` before this rule ever runs.

## Immediate (upgrade, or same-plan monthly→yearly)

1. `previewPlanChange` calls Paddle's real `subscriptions.preview` endpoint
   (`previewSubscriptionUpdate` in `paddle-api.ts`) — read-only, no billing side effect — and
   returns the real prorated total Paddle computes, for display before the customer confirms.
2. `confirmPlanChange` calls Paddle's real `subscriptions.update` with
   `proration_billing_mode: "prorated_immediately"` (`updateSubscriptionItem`) — this is the one
   real, billing-affecting call in this flow.
3. **`users.plan_id` is never written by this code path.** The actual entitlement grant happens
   only when the resulting `subscription.updated` webhook arrives and is processed by
   `webhook-processor.ts`, exactly like every other entitlement change in this app (see
   `apps/web/src/pages/api/billing/AGENTS.md`). `confirmPlanChange` only clears any stale
   `scheduled_*` markers on the local `subscriptions` row (in case an earlier scheduled downgrade
   is being superseded by this immediate change) — it does not itself grant anything.

## Scheduled (downgrade, or same-plan yearly→monthly)

Paddle Billing has no native "schedule this price/item change for later" mechanism — confirmed by
reading `subscriptions.update`'s schema via the Paddle MCP connection: its `scheduled_change`
field can only ever be set to `null` (cancelling a pending Paddle-side scheduled change), never
populated with a future item change. Real scheduled changes in Paddle only exist for
pause/cancel/resume, not arbitrary item swaps.

So this is implemented entirely at the application level:

1. `confirmPlanChange` writes `scheduled_plan_id`, `scheduled_paddle_price_id`, and
   `scheduled_change_effective_at` (= the subscription's current `current_period_end`) on the
   local `subscriptions` row. **Nothing is sent to Paddle.**
2. This alone is what preserves the customer's current entitlements until the effective date —
   there is no separate gating check anywhere else in the app; the subscription's real Paddle
   price and local `plan_id`/`billing_interval` are simply untouched until step 3 runs.
3. A daily Worker `scheduled()` cron sweep (`applyDueScheduledDowngrades` in
   `apps/web/src/lib/billing/scheduled-downgrades.ts`, wired into `worker.ts`'s `scheduled()`
   handler as the `scheduled_plan_changes` job) selects every subscription where
   `scheduled_change_effective_at <= now`, and only then calls Paddle's real
   `subscriptions.update` with `proration_billing_mode: "do_not_bill"` — the customer already paid
   for the period they're finishing, so this must never trigger an additional charge.
4. Clears the local `scheduled_*` markers once the Paddle call succeeds. As with the immediate
   case, the actual plan grant still only happens via the resulting webhook, not from this sweep
   directly.

A customer can cancel a pending scheduled change before its effective date via
`POST /api/billing/plan-change/cancel-scheduled` (`cancelScheduledPlanChange`) — purely local,
since nothing was ever sent to Paddle for a scheduled change, there is nothing to undo there.

## Why proration is never computed locally

`previewSubscriptionUpdate` and `updateSubscriptionItem` are the only two places a proration
number is ever produced, and both call Paddle's real API. No proration math is duplicated or
approximated in this codebase — the number shown in the preview step and the number actually
charged at confirm time are each independently computed by Paddle at the moment of the call, not
cached or reused from one step to the other (see
`docs/security/PHASE_06_BILLING_AND_CHECKOUT_THREAT_REVIEW.md` §22 for the security implication of
that gap).

## Interaction with the existing webhook race/idempotency guarantees

Both the immediate and scheduled paths ultimately rely on the same `last_applied_occurred_at`
compare-and-swap in `webhook-processor.ts` to apply the resulting Paddle event — no new race class
is introduced by plan changes; see `docs/security/PHASE_06_BILLING_AND_CHECKOUT_THREAT_REVIEW.md`
§11 and §13.
