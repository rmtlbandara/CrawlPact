# Paddle webhook event matrix

How `apps/web/src/lib/billing/webhook-processor.ts` routes and handles every Paddle Billing event
type this account is subscribed to. Routing is **prefix-based**, not an exhaustive per-type
switch — see `processPaddleWebhookEvent()`'s final `if (event.eventType.startsWith(...))` chain —
so a new event type Paddle adds under an already-handled prefix is automatically routed correctly
without a code change; only a genuinely new _category_ of event (a fifth prefix beyond
subscription/transaction/adjustment/customer) would need a new branch.

The live notification destination is subscribed to 24 event types across these 4 prefixes (see
`docs/billing/PHASE_06_EXISTING_BILLING_BASELINE.md`'s environment-identity verification, which
cross-checked this against the account's real `notificationSettings.list` response). This document
describes handling by **prefix and known concrete examples**, not a hand-maintained enumeration of
all 24 — the prefix dispatch means the exact list can drift in Paddle's dashboard without this
document going stale.

## `subscription.*` → `handleSubscriptionEvent`

Handles the full lifecycle: `subscription.created`, `subscription.activated`,
`subscription.updated`, `subscription.canceled`, `subscription.paused`, `subscription.resumed`,
and any other `subscription.*` type Paddle sends. Behaviour:

- Resolves `items[0].price.id` → plan/interval via `resolvePriceToPlan()` (legacy-aware, see
  `LEGACY_PRICE_AND_SUBSCRIBER_POLICY.md`) — falls back to the existing row's `planId` if the
  price can't be resolved (an unknown price ID) or to `"free"` for a brand-new row with no
  resolvable price.
- Links to a `billing_customers` row via `customer_id`, creating one if `custom_data.userId` is
  present and no row exists yet (see `findOrCreateBillingCustomer`).
- Maps Paddle's `status` through `PADDLE_TO_LOCAL_STATUS` (`active`, `trialing`, `past_due`,
  `paused`, `canceled` → `cancelled`) — an unmapped status is treated as `failed` rather than
  silently stored.
- Applies the entitlement via `applyPlanFromStatus`: `active`/`trialing` → grant; `past_due` →
  leave untouched (grace period); anything else → revoke to `free`.
- Every write goes through the `last_applied_occurred_at` compare-and-swap — an out-of-order
  delivery is recorded as `ignored_out_of_order`, never applied (see
  `docs/status/BILLING_WEBHOOK_RACE_TEST_FLAKE.md` for the exact race this closes).
- Persists `paddle_price_id`/`billing_interval` on every apply (Phase 6 addition) alongside the
  pre-existing `plan_id`/`status`/`current_period_end`/`cancel_at_period_end` fields.

## `transaction.*` → `handleTransactionEvent`

Handles `transaction.created`, `transaction.updated`, `transaction.ready`, `transaction.paid`,
`transaction.completed`, and any other `transaction.*` type. Records/updates a row in
`transactions`, linked to a subscription if `subscription_id` is present. A transaction with no
`customer_id` yet (Paddle sends `created`/`updated` for a `draft` transaction mid-checkout, before
a customer is attached) is recorded as `ignored_no_customer_yet` — not an error, not a dropped
event; a later event on the same transaction ID carries the customer once checkout completes.
Verified against real production traffic 2026-07-28 (`docs/status/PADDLE_WEBHOOK_LIVE_DELIVERY_VERIFICATION.md`)
— every synthetic-customer transaction event in that test correctly recorded as `failed`
(genuinely no local linkage existed for a synthetic test customer, not a bug).

## `adjustment.*` → `handleAdjustmentEvent`

Handles refunds and chargebacks by looking up the referenced transaction (`transaction_id`) and
setting `refund_status`/`chargeback_status`. **Known, accepted gap**: only the `refund` and
`chargeback` actions are understood — a `credit` adjustment action returns
`ignored_unhandled_type` (silently dropped). This is a pre-existing condition (confirmed during
Phase 6's baseline research, not introduced by this phase) and is not a functional gap for Phase 6
specifically, since Phase 6 introduces no discount/credit/proration-adjustment feature that would
generate a `credit` adjustment — see `docs/status/KNOWN_RISKS.md`.

## `customer.*` → `handleCustomerEvent`

Handles `customer.created`/`customer.updated`. Creates or links a `billing_customers` row if
`custom_data.userId` is present; otherwise `ignored_unhandled_type` (no linkage yet — a later
subscription/transaction event on the same customer will create it).

## Idempotency and ordering (applies to every prefix)

- **Idempotent by `paddle_event_id`** (`UNIQUE` on `webhook_events.paddle_event_id`): any event
  already `processed`/`ignored`/`permanently_failed` short-circuits to `"duplicate"` — a replayed
  delivery is a 200 no-op, never reprocessed or double-applied. A `pending`/`failed`/`retrying` row
  genuinely reruns the handler.
- **Ordering** is enforced only where it matters (the subscription row's own state) via the
  compare-and-swap described above — `transactions`/`adjustments`/`customers` don't have an
  equivalent ordering concept in this schema, since they're append/upsert-by-external-ID rather
  than a mutable state machine.
- **Retry/backoff**: up to `MAX_ATTEMPTS_BEFORE_GIVING_UP` (5) attempts before a failing event is
  marked `permanently_failed` and surfaced in the Super Admin `/admin/webhooks` retry UI.

## What Phase 6 changed here, precisely

Only the price→plan resolution call (`mapPriceIdToPlanId` → `resolvePriceToPlan`) and the two new
persisted fields (`paddle_price_id`, `billing_interval`) on the subscription-update/insert paths.
No routing logic, no idempotency logic, no CAS logic, and no adjustment/transaction/customer
handling changed.
