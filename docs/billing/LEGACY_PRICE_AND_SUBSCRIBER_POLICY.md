# Legacy price and existing-subscriber policy

What happens to a Paddle price and the subscribers on it once a newer price supersedes it for new
checkout. Applies to the 3 pre-Phase-6 annual prices that predate the DB-backed `plan_prices`
catalog (Solo/Pro/Agency, $79/$179/$399 per year) and to any future repricing.

## The rule

A price is never deleted or archived just because a newer price exists for the same plan. It is
marked `legacy = 1, active_for_new_checkout = 0` in `plan_prices` and left in place indefinitely,
because:

1. **Existing subscribers stay on it.** Nothing in this codebase ever moves a live subscriber from
   one Paddle price to another automatically. A subscriber who purchased the $79/yr Solo price
   keeps paying $79/yr, renewing at $79/yr, forever — until they themselves choose to change plan
   or interval through `/app/billing` (which is a normal plan-change, priced at whatever the
   _current_ catalog says for their chosen target, not a forced migration).
2. **Their webhook events must keep resolving.** `resolvePriceToPlan()`
   (`apps/web/src/lib/billing/plan-catalog.ts`) has no `active_for_new_checkout` filter — it
   resolves **any** row in `plan_prices`, current or legacy. Every `subscription.updated`,
   `transaction.created`, etc. Paddle ever sends for that subscriber references their original
   price ID, and this resolution must keep working for the lifetime of that subscription, not just
   until the price is superseded.
3. **New checkouts never see it.** `resolveCheckoutPrice()` filters on `active_for_new_checkout =
true` unconditionally — a legacy row can never be returned to a new purchase, regardless of
   what plan/interval a client requests.

## What "archiving" actually means, and when it's allowed

`plan_prices.archived_at` is a separate, stricter state from `legacy`. A price may only be set
`archived_at` once **zero subscribers remain on it** — i.e. every subscription that ever
referenced that `paddle_price_id` has since cancelled, expired, or moved to a different price.
The Super Admin catalog view (`/admin/plans`, `computeCatalogStatusFlags()`) actively flags a
contradiction — an archived price with a nonzero live subscriber count — as an error, because that
state should be structurally impossible if this rule is followed. Archiving is a local metadata
change only; it is never itself a live Paddle write (see
`docs/billing/PADDLE_LIVE_PREFLIGHT_CHANGE_MANIFEST.md` for the live-write process that governs
anything touching Paddle's actual catalog).

## What Phase 6 did, concretely

The 3 pre-Phase-6 annual prices were seeded into `plan_prices` as
`{ legacy: 1, active_for_new_checkout: 0, archived_at: NULL }` (see
`packages/database/seed/reference-data.sql`, the `*_production_legacy` rows) — not archived,
because the one existing Solo subscriber (see
`docs/billing/PHASE_06_EXISTING_BILLING_BASELINE.md`) is still on one of them. No existing
subscriber was migrated, no legacy price was deleted or archived, and the live Paddle catalog
itself was never modified for these 3 prices — only 6 new prices were created alongside them (see
`docs/billing/PADDLE_LIVE_CATALOG_MAP.md`).

## Interaction with plan changes

If an existing subscriber on a legacy price uses `/app/billing` to change plan or interval, the
target price is always resolved through the normal `resolveCheckoutPrice`/plan-change path — i.e.
always a _current_, `active_for_new_checkout` price, never another legacy one. There is no path
that moves a subscriber from one legacy price to another legacy price, and no path that
"refreshes" a subscriber back onto the current price for their existing plan/interval without an
explicit plan-change action on their part.
