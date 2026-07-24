# Billing Security

**Implemented in Part 2** (`apps/web/src/lib/billing/`, `apps/web/src/pages/api/billing/`),
covered by `apps/web/tests/integration/billing-webhook.integration.test.ts` (10 fixture
scenarios: creation, update, renewal, past-due grace, scheduled cancellation, effective
cancellation, refund, duplicate event, out-of-order event, invalid signature).

**Not verified against a live Paddle account** — no sandbox credentials were available for this
phase. The signature-verification/idempotency/state-machine logic is proven correct against
self-generated HMAC fixtures matching Paddle's publicly documented webhook shape; the shape
itself (exact field names on subscription/transaction/adjustment payloads) has not been
confirmed against a real account. See `apps/web/src/pages/api/billing/AGENTS.md` and
`lib/billing/webhook-processor.ts`'s docstring. Treat this as needing a real-account smoke test
before launch.

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
lifecycle state machine are implemented and tested (10/10 fixture scenarios pass). Checkout
initiation (Paddle.js overlay) and the customer portal session endpoint are implemented but
**not** exercised against a real Paddle account — that verification, plus a Super Admin
view/retry UI for failed webhooks, remain open for a later phase.
