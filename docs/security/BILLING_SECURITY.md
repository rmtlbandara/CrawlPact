# Billing Security

**Implemented in Part 2** (`apps/web/src/lib/billing/`, `apps/web/src/pages/api/billing/`),
covered by `apps/web/tests/integration/billing-webhook.integration.test.ts` (10 fixture
scenarios: creation, update, renewal, past-due grace, scheduled cancellation, effective
cancellation, refund, duplicate event, out-of-order event, invalid signature).

**Verified against the live Paddle account on 2026-07-28** — a Paddle webhook simulation delivered
8 real, `Paddle-Signature`-signed events to `https://crawlpact.com/api/billing/webhook` in
production; every one was correctly signature-verified, parsed, dispatched, and recorded, and one
intentionally-unsubscribed event type was correctly never delivered. The
signature-verification/idempotency/state-machine logic, previously proven only against
self-generated HMAC fixtures, is now also proven against genuine Paddle-originated traffic. See
`docs/status/PADDLE_WEBHOOK_LIVE_DELIVERY_VERIFICATION.md` for full evidence. What remains
unverified: a real **paid** checkout lifecycle (real payment, real `custom_data.userId` linkage,
real plan grant) — deliberately not run without separate explicit authorization, since no real
charge may be triggered.

## Non-negotiables (SRS §27, §33)

- Paddle is the billing source of truth. Local tables (`billing_customers`, `subscriptions`,
  `transactions`, `webhook_events`) are a cache sufficient to identify the
  customer/subscription/plan and detect sync errors — `users.plan_id` (the actual entitlement
  gate everywhere else in the app) is only ever written from a verified webhook event, never from
  a client-supplied value.
- Every inbound webhook is signature-verified (HMAC-SHA256 over `timestamp:rawBody`, Paddle's
  documented `Paddle-Signature: ts=...;h1=...` scheme, timing-safe comparison, 5-minute replay
  window) against the **raw** request body — see `lib/billing/paddle-webhook.ts`.
- Webhook processing is idempotent by `paddle_event_id` (unique constraint on
  `webhook_events.paddle_event_id`) — a replayed event is a no-op that still returns 200, not an
  error and not a double-grant of entitlements. A `pending`/`failed`/`retrying` row is genuinely
  reprocessed on retry (not silently swallowed); only `processed`/`ignored`/`permanently_failed`
  short-circuit.
- Out-of-order events are rejected by comparing the incoming event's `occurred_at` against the
  most recent _processed_ event for that subscription — a late-arriving stale event can never
  revert a subscription to older state (`isOutOfOrder` in `webhook-processor.ts`).
- Sensitive payload fields (`custom_data`) are stripped before storage
  (`webhook_events.payload_redacted`).
- Past-due is a grace period, not an immediate downgrade: `users.plan_id` is left untouched while
  a subscription is `past_due`; only `cancelled`/`expired`/`paused` revoke the paid entitlement.

## Temporary entitlements

`temporary_entitlements` (manual grant, requiring expiry/reason/audited actor) has no
implementation yet — it's Super Admin tooling, Part 3 scope, correctly not built here.

## Definition of done for this area

Webhook signature verification, idempotency, out-of-order protection, and the full subscription
lifecycle state machine are implemented and tested (10/10 fixture scenarios pass), **and** now
verified against real, signed Paddle production traffic (2026-07-28, see above). A Super Admin
view/retry UI for failed webhooks is implemented (`/admin/webhooks`). Checkout initiation
(Paddle.js overlay) and the customer portal session endpoint are implemented but not yet
exercised against a real **paid** transaction — that remains open for a later, separately
authorized phase.
