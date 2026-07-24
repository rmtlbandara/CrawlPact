# AGENTS.md — apps/web/src/pages/api/billing

Paddle Billing integration (SRS §27). Read the parent `AGENTS.md` first; this file adds what's
specific to billing.

## The one rule that matters

Paddle is the source of truth for billing state. Everything in `packages/database`'s billing
tables (`billing_customers`, `subscriptions`, `transactions`, `webhook_events`) is a **cache**,
rebuilt from webhook events — never treat a local row as authoritative if it could have drifted
from Paddle, and never let a local write be the only place a plan change takes effect (it must
always originate from a webhook event or, for checkout initiation, a real user action that Paddle
will itself confirm via webhook).

## Webhook endpoint (`webhook.ts`)

1. Verify the `Paddle-Signature` header against the **raw request body** before doing anything
   else — never parse JSON first and re-verify against re-serialised text (see
   `../../../lib/billing/paddle-webhook.ts`'s docstring for why that silently breaks
   verification).
2. Idempotency is by `paddle_event_id` (unique in `webhook_events`) — a replayed event must be a
   no-op that still returns 200, never reprocessed and never a 4xx/5xx (Paddle retries on
   non-2xx).
3. Every event that mutates a subscription must go through the out-of-order check in
   `webhook-processor.ts` (`isOutOfOrder`) — a webhook that arrives late must never overwrite a
   newer state with a stale one.

## Never

- Trust a client-supplied plan ID, price ID, or subscription status for anything except _which
  checkout to open_. The user's actual entitlement (`users.plan_id`) is only ever set from a
  verified webhook event.
- Call Paddle's server-to-server API (`lib/billing/paddle-api.ts`) from anywhere except a
  request the signed-in user themselves initiated (e.g. requesting a portal session for their
  own account) — never on behalf of another user.
- Log a raw webhook payload without redaction — `payload_redacted` in `webhook_events` exists
  specifically so `custom_data`/PII-adjacent fields aren't retained verbatim.

## What's unverified

The Paddle API field names/shapes here (webhook payloads, portal-session response) follow
Paddle's public docs as best understood but have **not** been exercised against a real Paddle
sandbox account — none was available when this was built (see the Part 2 final report). Verify
against a live account before launch; the self-generated-HMAC webhook tests only prove the
signature/idempotency/state-machine logic is correct for payloads of the assumed shape.
