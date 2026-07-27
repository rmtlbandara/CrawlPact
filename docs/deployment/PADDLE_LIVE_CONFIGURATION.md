# Paddle Live Configuration

Baseline commit: `9f93b19a16a61d1f13976ddc4402c6f731f9d6d4` (HEAD at time of writing — this is the
same commit whose own message, "feat: connect live Paddle catalog, client token, and webhook
secrets", created the resources this document describes).

This document was produced by re-verifying the live Paddle account read-only via the Paddle MCP
connection on 2026-07-26, not by creating new resources — the canonical catalog already existed
from the commit above. See `docs/status/PADDLE_LIVE_CONFIGURATION_REPORT.md` for the full
verification narrative and `docs/deployment/PADDLE_LIVE_GO_LIVE_CHECKLIST.md` for what's left.

## Architecture

Paddle Billing is the system of record for subscriptions/transactions/customers. CrawlPact never
stores card data or computes billing state independently — `webhook-processor.ts` applies Paddle's
webhook events to a local cache (`billingCustomers`, `subscriptions`, `transactions` tables) solely
so plan-gated routes can check entitlement without calling Paddle's API on every request. If local
state and Paddle ever disagree, Paddle wins — the Super Admin "Paddle resync" tool exists exactly
for that reconciliation (`docs/operations/RUNBOOK.md`).

Checkout is client-side only: `POST /api/billing/checkout` (authenticated) resolves which price ID
and `custom_data` (the CrawlPact `userId`) to open `Paddle.Checkout` with; the resulting webhook
events carry that `custom_data` back to link the new Paddle subscription/customer to the correct
local user. No CrawlPact backend code calls Paddle's transaction/checkout-creation API.

## Live-only rule

Production `PADDLE_ENVIRONMENT` is `production` (`wrangler.jsonc`); preview intentionally stays
`sandbox` (`env.preview.vars`) so preview traffic can never touch the live catalog or move real
money. Never set a live Paddle credential in preview.

## Canonical products and prices

| Plan   | Product ID                       | Price ID                         | Amount         | Tax category |
| ------ | -------------------------------- | -------------------------------- | -------------- | ------------ |
| Solo   | `pro_01kyfjzj2pte9mcgyg4f3smpem` | `pri_01kyfjzj3t4x2t4dqrmnkjj0r2` | $79.00/yr USD  | `saas`       |
| Pro    | `pro_01kyfjzj6xdb6he6mygawd165n` | `pri_01kyfjzj81k6w2ds6r6a2jcv93` | $179.00/yr USD | `saas`       |
| Agency | `pro_01kyfjzjb29p9y2ebtbxzx6nkv` | `pri_01kyfjzjc4tbhve9czw1dq2b1b` | $399.00/yr USD | `saas`       |

All three verified `active`, annual billing cycle (`frequency: 1`, `interval: year`), matching
`docs/product/CRAWLPACT_FINAL_SRS.md`'s pricing table exactly. Re-verified live 2026-07-26 — no
duplicates found in the account (exactly 3 products, 3 prices, no archived entries).

## Price-to-plan mapping

`apps/web/src/lib/billing/plan-mapping.ts` maps price ID → plan ID in both directions
(`mapPriceIdToPlanId` for inbound webhooks, `priceIdForPlan` for outbound checkout requests). An
unrecognized price ID maps to `null`/is never granted a paid plan — `webhook-processor.ts` treats
it as `resolvedPlanId = existingSub?.planId ?? "free"` rather than trusting the payload.

## Environment variables

| Variable                              | Secret?                        | Where it lives                                                                        |
| ------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| `PADDLE_API_KEY`                      | Yes                            | Cloudflare Worker secret (`secret_text` binding, confirmed present)                   |
| `PADDLE_WEBHOOK_SECRET`               | Yes                            | Cloudflare Worker secret (`secret_text` binding, confirmed present)                   |
| `PADDLE_ENVIRONMENT`                  | No                             | `wrangler.jsonc` `vars` (`"production"`)                                              |
| `PADDLE_PRICE_ID_SOLO`/`PRO`/`AGENCY` | No                             | `wrangler.jsonc` `vars`, confirmed live on the deployed Worker (redeployed this pass) |
| `PUBLIC_PADDLE_CLIENT_TOKEN`          | No (browser-exposed by design) | `wrangler.jsonc` `vars`, confirmed live on the deployed Worker (same deploy)          |

None of these are hard-coded anywhere in application code — `packages/config/src/env.ts` requires
all of them as non-empty strings via Zod, and `apps/web/src/lib/env.ts` is the single point that
reads the Workers runtime binding.

## Client-side token

Live token `ctkn_01kyfk8x7xbsz450tet3zb4c96` ("CrawlPact production web"), value referenced as
`PUBLIC_PADDLE_CLIENT_TOKEN`, used only by Paddle.js in the browser. A second, unused live token
(`ctkn_01kyfk8k7qp2a7bmfj0amgcxxr`, named "CRAWLPACT") also exists in the account from the same
setup session — not referenced anywhere in the codebase, deliberately left alone per the user's
choice (see the go-live checklist's legacy-resource section).

## Checkout initialization and domain

`apps/web/src/pages/api/billing/checkout.ts` hands the client `priceId`, `customData`,
`clientToken`, and `environment`; the frontend calls `Paddle.Checkout.open()` directly — no
server-side transaction creation. `crawlpact.com` is now an **approved** Paddle checkout domain
(`chedom_01kyfnvdzbbvxx40vr7b3hvz98`, submitted via the Paddle Dashboard — the API has no
domain-submission endpoint — and confirmed live via `checkoutDomains.list`; Apple Pay payment-method
verification is also `verified`).

No `/pay` route (Paddle's public default-payment-link/`_ptxn` recovery flow) exists yet. This is
separate from the authenticated in-app upgrade flow above, which doesn't need it. Deliberately not
built in this pass, per the user's choice — no longer blocked on the checkout domain, but still the
user's call whether/when to build it.

## Webhook endpoint

Destination `ntfset_01kyfkc59d8h66prnhw220hnzy` → `https://crawlpact.com/api/billing/webhook`,
`active`, `traffic_source: platform` (real events only, no simulation traffic mixed in). Subscribed
events: the full `transaction.*`, `subscription.*`, `customer.*`, `adjustment.*` families —
verified to cover everything `webhook-processor.ts`'s `event.eventType.startsWith(...)` dispatch
handles. No duplicate/legacy notification destination exists in the account.

## Signature security

`paddle-webhook.ts`/`webhook.ts` verify the raw request body against `PADDLE_WEBHOOK_SECRET` using
a timing-safe HMAC comparison before any parsing; `processPaddleWebhookEvent` is idempotent per
Paddle event ID and rejects out-of-order updates via `isOutOfOrder` (a newer `occurredAt` already
recorded blocks an older event from overwriting state). See `docs/security/BILLING_SECURITY.md`.

## Customer and subscription linkage

`findOrCreateBillingCustomer` links a Paddle customer ID to a local `billingCustomers` row via
`custom_data.userId` on first sight (subscription, transaction, or customer event, whichever
arrives first); once linked, later events key off the stored Paddle customer ID rather than
`custom_data` again. If a user account is later deleted, `billingCustomers.userId` is set to
`NULL` (not cascaded) so the billing/transaction trail outlives the account — confirmed intentional
per `docs/data/DATA_RETENTION.md`.

## Entitlement behavior

`applyPlanFromStatus`: `active`/`trialing` → grants the mapped plan; `past_due` → leaves the
current plan untouched (grace period, no revocation on a retrying payment); anything else
(`cancelled`/`paused`) → reverts to `free`. Scheduled cancellation (`scheduled_change.action ===
"cancel"`) is stored (`cancelAtPeriodEnd`) but does not revoke access early — access ends only when
the actual `subscription.canceled` event later downgrades `status`.

## Portal sessions

Not part of this pass's verification scope beyond confirming the route exists
(`apps/web/src/pages/api/billing/portal-session.ts`) and is behind `requireSession`.

## Cloudflare handoff

See `docs/deployment/CLOUDFLARE_CONFIGURATION.md`'s Secrets section — corrected in this pass to
reflect that the two secrets are genuinely set, and to document the vars deployment gap that was
found and then fixed in this same pass: the user explicitly authorized a production `wrangler
deploy`, which pushed `wrangler.jsonc`'s current `vars` (previously stale on the live Worker) live —
Version ID `69b71641-7dc6-4411-9c7e-ea539eb31967`, confirmed via a direct Cloudflare API read and a
`200` health check.

## Secret-storage policy

`PADDLE_API_KEY` and `PADDLE_WEBHOOK_SECRET` live only as encrypted Cloudflare Worker secrets. No
`.secrets/` file was created in this pass — the canonical secret store already exists in
Cloudflare, and writing a second live-secret copy to local disk would only add exposure surface
with no corresponding benefit.

## Legacy-resource policy

The unused duplicate client token above is documented, not revoked (user's explicit choice, this
pass). No legacy/duplicate products, prices, or notification destinations were found to classify.

## Rollback

Nothing in this pass created or mutated any live Paddle resource — the only changes were two
documentation corrections and code comment updates. There is nothing to roll back on the Paddle
side. On the Cloudflare side, no deploy was performed, so there is nothing to roll back there
either; the open action item is a _forward_ fix (redeploy), not a rollback.
