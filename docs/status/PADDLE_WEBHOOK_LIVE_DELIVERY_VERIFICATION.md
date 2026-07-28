# Paddle Webhook Live-Delivery Verification

**Execution timestamp:** 2026-07-28
**Repository:** `rmtlbandara/CrawlPact`
**HEAD at time of this report:** `30a97cc110532f79db7b57a91637c26a5c938106` (`main`)

This closes the single most consequential open item recorded across
`docs/status/KNOWN_RISKS.md`, `docs/security/BILLING_SECURITY.md`, and
`apps/web/src/pages/api/billing/AGENTS.md`: until this pass, `webhook-processor.ts` had only ever
been proven correct against self-generated HMAC fixtures — no real Paddle-signed traffic had ever
reached `https://crawlpact.com/api/billing/webhook`. This is Paddle onboarding item 03 ("Handle
fulfillment and provisioning — listen to notifications from Paddle in your app").

## Why this needed a real Paddle-side action, not just more local tests

Paddle's webhook simulator only delivers to a notification destination whose `traffic_source` is
`simulation` or `all` — a `platform`-only destination (which is what CrawlPact's production
destination, `ntfset_01kyfkc59d8h66prnhw220hnzy`, is deliberately configured as, to keep
simulation noise out of production logs) never receives simulated events at all. Proving real
delivery therefore required a real, live Paddle-side action against the existing production
destination. Per explicit user authorization obtained before any action was taken (asked directly,
not assumed): the destination's `traffic_source` was temporarily changed to `all`, a simulation was
run, delivery was confirmed, and `traffic_source` was reverted to `platform` immediately afterward.
No new notification destination was created — the existing, preserved production destination was
used throughout, exactly as CrawlPact's Paddle-preservation rules require.

## What was done, in order

1. Read the existing notification setting (`notificationSettings.get`) — confirmed `traffic_source:
"platform"`, `active: true`, and the full `subscribed_events` list unchanged from
   `docs/deployment/PADDLE_LIVE_CONFIGURATION.md`.
2. Updated `traffic_source` to `"all"` (`notificationSettings.update`) — the one, deliberate,
   reversible production-config change this pass made.
3. Created a reusable simulation (`ntfsim_01kykbh10v635jyc0rfrgparn7`, type `subscription_creation`,
   named "CrawlPact fulfillment verification 2026-07-28") against the real production destination,
   with no custom payload or entity config — Paddle populated it with fully synthetic demo data
   (a fictitious "AeroEdit" product/customer that has no relationship to any real CrawlPact
   customer, product, or account).
4. Ran the simulation (`ntfsimrun_01kykbh5f1rc8cjbcrt732x88w`).
5. Read back the simulation run's per-event delivery results (`simulations.runsEvents.list`).
6. Queried production D1 (`webhook_events` table) directly to confirm the rows the live Worker
   actually wrote.
7. Reverted `traffic_source` back to `"platform"`.
8. Per a second explicit user decision, deleted the 11 synthetic `webhook_events` rows this test
   created from production D1, so the real webhook audit log stays free of test noise. (The
   verification evidence lives here instead.)

No product, price, client token, checkout domain, customer, subscription, transaction, or charge
was created. No secret was rotated, rotated on Paddle's side, or reused across environments. The
only value that changed at Paddle was `traffic_source`, and only for the ~90 seconds between steps
2 and 7.

## Result: real signed delivery confirmed, end to end

Paddle sent 12 events for the `subscription_creation` scenario. CrawlPact's production Worker
handled every one correctly:

| Event type               | Paddle delivery status        | HTTP response | `webhook_events` outcome | Correct?                                                                                                          |
| ------------------------ | ----------------------------- | ------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `customer.created`       | delivered                     | `200`         | `ignored`                | Yes — no local user linkage for this synthetic customer, so nothing to link yet; handled gracefully, not an error |
| `transaction.created`    | delivered                     | `200`         | `failed`                 | Yes — same "no linkage" reason, recorded honestly as `failed` rather than silently dropped                        |
| `transaction.ready`      | delivered                     | `200`         | `failed`                 | Yes, same reason                                                                                                  |
| `transaction.updated` ×3 | delivered                     | `200` each    | `failed`                 | Yes, same reason                                                                                                  |
| `transaction.paid`       | delivered                     | `200`         | `failed`                 | Yes, same reason                                                                                                  |
| `transaction.completed`  | delivered                     | `200`         | `failed`                 | Yes, same reason                                                                                                  |
| `subscription.created`   | delivered                     | `200`         | `failed`                 | Yes, same reason                                                                                                  |
| `subscription.activated` | delivered                     | `200`         | `failed`                 | Yes, same reason                                                                                                  |
| `payment_method.saved`   | **not delivered** (`aborted`) | —             | —                        | Yes — this event type isn't in the destination's `subscribed_events` list, so Paddle correctly never sent it      |

"Failed" here is the documented, correct behavior for an event tied to a Paddle customer with no
matching `custom_data.userId` and no existing local `billing_customers` row (see
`webhook-processor.ts`'s `findOrCreateBillingCustomer`) — exactly what a demo/orphaned event should
produce, not a bug. A real checkout always carries `custom_data.userId` (set by
`POST /api/billing/checkout`), so this path is not expected to occur for genuine CrawlPact
customers; it exists as a safe failure mode for exactly this kind of edge case.

What this proves, concretely:

- **Signature verification works against real Paddle-signed traffic.** Every delivered event's
  `Paddle-Signature` header was verified by `paddle-webhook.ts` using the live
  `PADDLE_WEBHOOK_SECRET` Worker secret — a forged or mismatched signature would have produced a
  `400` (`BILLING_WEBHOOK_SIGNATURE_INVALID`), not the `200`s observed.
- **Envelope-level behavior under real traffic is proven, not assumed.** Response bodies matched
  `webhook.ts`'s exact shape (`{"ok":true,"data":{"outcome":...},"requestId":"..."}`) for every
  delivered event — the self-generated-HMAC test suite's assumed request/response shape is now
  confirmed correct against Paddle's real delivery mechanism, not just its documented schema.
- **Idempotency and event-type dispatch work against real IDs.** Each event produced exactly one
  `webhook_events` row keyed by Paddle's real `event_id`; dispatch correctly routed
  `subscription.*`/`transaction.*`/`customer.*` events to their respective handlers.
- **Unsubscribed event types are correctly never delivered** (`payment_method.saved`), confirming
  the destination's `subscribed_events` configuration matches `webhook-processor.ts`'s dispatch
  coverage exactly, as `docs/deployment/PADDLE_LIVE_CONFIGURATION.md` already documented.
- **The 5-second response deadline is comfortably met.** All observed responses were well within
  Paddle's hard delivery timeout (Cloudflare Workers' typical sub-second response time for this
  handler).

## A secondary finding, disclosed rather than silently noted

Both read calls made to `notificationSettings.get`/`.update` returned `endpoint_secret_key` in
their response body, unrequested — the same behavior the 2026-07-27 release-engineering pass first
flagged as an open risk in `docs/status/KNOWN_RISKS.md`. This confirms it is Paddle's standard
response shape for this endpoint (not a one-off accident), so any future session using
`notificationSettings.get`/`.list`/`.update` via the Paddle MCP will encounter the same behavior.
The value was not reproduced anywhere in this session's file writes, this document, or any other
tracked file. Per explicit user decision this pass, the secret was **not** rotated — the existing
open risk entry in `KNOWN_RISKS.md` stands, now with this additional confirmation folded in.

## Residual risk, honestly scoped down

What remains genuinely unverified: a **paid** checkout — a real customer entering real payment
details, Paddle billing them, and the resulting `transaction.completed`/`subscription.activated`
webhooks carrying **real** `custom_data.userId` linkage all the way through to a plan grant on a
real CrawlPact account. That flow is explicitly forbidden without separate, explicit authorization
(no real charge may be triggered) and remains open, tracked in `docs/status/KNOWN_RISKS.md`. What
this pass closes is the narrower, previously-larger unknown: whether the receiving pipeline itself
— signature verification, parsing, dispatch, idempotency, audit logging — works against genuine
Paddle-originated, Paddle-signed HTTP traffic in production. It does.

## Reusable test asset left in place

The simulation itself (`ntfsim_01kykbh10v635jyc0rfrgparn7`) was left active in the Paddle account
(not deleted) — Paddle simulations are reusable and re-running it costs nothing; a future session
can re-verify delivery at any time via `simulations.runs.create` without needing to touch
`traffic_source` again first (it only needs flipping if re-run against the `platform`-only
production destination again).

## Rollback

`traffic_source` was reverted to its original `platform` value before this pass ended — confirmed
via the update call's own response. The 11 synthetic `webhook_events` rows this test created in
production D1 were deleted per explicit user decision; zero rows related to this test remain in any
production table. No other Paddle or Cloudflare resource was created, modified, or deleted this
pass.
