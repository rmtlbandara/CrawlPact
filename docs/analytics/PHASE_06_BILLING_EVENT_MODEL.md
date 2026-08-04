# Phase 6 analytics event model: pricing, plan architecture and checkout continuity

The 8 `PRODUCT_EVENT_NAMES` entries (`apps/web/src/lib/analytics.ts`) added for pricing,
checkout, and plan-change. Same first-party-only model as every other product event in this
codebase (SRS §33): no third-party analytics, `isProductEventName()` enforces the closed union
server-side, and **no Paddle customer/subscription/transaction ID, email, full domain, price ID,
checkout token, or payment detail is ever sent as a property** — only closed-enum plan
IDs/intervals/directions and, where relevant, the caller's own `userId` (already the standard for
every server-recorded event in this file, e.g. `subscription_activated`).

## Events, in typical firing order

| #   | Event                       | Fired from                                                                                           | Properties                        | Fires when                                                                                                                                        |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `billing_interval_selected` | `PricingPlans.tsx` / `BillingPlansSection.tsx` (client)                                              | `interval`                        | The monthly/yearly toggle is clicked, on either the public pricing page or the authenticated billing page                                         |
| 2   | `plan_selected`             | `PricingPlans.tsx` (client, CTA click) / `CheckoutButton.tsx` (client, on click, before the request) | `planId`, `interval`              | A plan's CTA is clicked                                                                                                                           |
| 3   | `checkout_started`          | `POST /api/billing/checkout` (server)                                                                | `planId`, `interval`              | The server successfully resolves a real, active Paddle price for the request — i.e. checkout is genuinely about to be offered, not just requested |
| 4a  | `checkout_opened`           | `CheckoutButton.tsx` (client)                                                                        | `planId`, `interval`              | `Paddle.Checkout.open()` is actually called (after `initializePaddle` succeeds)                                                                   |
| 4b  | `checkout_failed`           | `CheckoutButton.tsx` (client)                                                                        | `planId`, `interval`              | The checkout request fails, or Paddle.js fails to initialise — before the overlay ever opens                                                      |
| 5   | `plan_change_previewed`     | `POST /api/billing/plan-change/preview` (server)                                                     | `fromPlan`, `toPlan`, `direction` | A real Paddle proration preview (or scheduled-change date) is successfully computed and about to be shown to the customer                         |
| 6a  | `plan_change_confirmed`     | `POST /api/billing/plan-change/confirm` (server)                                                     | `toPlan`, `direction`             | The plan change is successfully applied (immediate: Paddle accepted the update; scheduled: the local markers were written)                        |
| 6b  | `plan_change_failed`        | same                                                                                                 | `toPlan`, `reason`                | The plan change could not be applied (`same_plan`, `price_unavailable`, or `paddle_api_error`)                                                    |
| 7   | `customer_portal_opened`    | `PortalButton.tsx` (client)                                                                          | —                                 | Immediately before redirecting to the Paddle-hosted portal URL                                                                                    |

Events 1, 2 (client CTA click), 4a, 4b, and 7 are client-side beacons (`track()` in
`analytics-client.ts`, fire-and-forget, never blocking navigation or surfacing an error to the
user). Events 3, 5, 6a, 6b are recorded server-side, in the same request that performs the
underlying resolution/mutation — consistent with this file's existing pattern for
mutation-adjacent events (`checkout_started` predates Phase 6 and already followed this rule;
`plan_change_*` follows the same one).

## Why `plan_change_previewed` fires server-side, not client-side

The preview endpoint makes a real call to Paddle's `subscriptions.preview` API — a genuine
server-side action with an external side effect worth recording precisely once, at the point it
succeeds, the same way `checkout_started` records the point a real price was resolved rather than
the point a button was clicked. An earlier draft of `PlanChangeButton.tsx` fired this event
client-side after receiving the preview response; that was consolidated into the single
server-side fire to avoid a double-count of the same moment (client and server would otherwise
both record the same successful preview as two separate `product_events` rows).

## Why `checkout_closed` and `checkout_completed_client` don't exist

Both were considered and rejected. `checkout_completed_client` would require registering a
Paddle.js checkout-completion callback — deliberately not done, since this codebase treats no
client-reported checkout state as authoritative for anything (see
`docs/security/PHASE_06_BILLING_AND_CHECKOUT_THREAT_REVIEW.md` §9); adding a callback whose only
purpose is a non-authoritative analytics beacon was judged not worth the added surface area this
late in a live-payments phase. `checkout_closed` (a Paddle.js `checkout.closed` callback, for
funnel-abandonment visibility) has a real, safe use case but no code wires it today — removed from
`PRODUCT_EVENT_NAMES` rather than left as an unfired reserved name, consistent with this
codebase's rule that a declared event name always corresponds to a real firing point. Either can
be added later as a genuine, scoped follow-up if abandonment-funnel visibility becomes a real
product need.

## Consistency check

`isProductEventName()` (enforced server-side on every `POST /api/analytics/track` call and every
`trackEvent()` call) rejects any name outside `PRODUCT_EVENT_NAMES` — the full unit/integration
suite (`vitest run --project unit --project integration`) exercises every server-recorded event in
this table via the real checkout/plan-change route handlers against a real D1 instance.
