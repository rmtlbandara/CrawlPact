# Phase 6 threat review: pricing, plan architecture and checkout continuity

Scope: everything Phase 6 added or changed — the DB-backed `plan_prices` catalog (migration
`0021_plan_prices.sql`), `apps/web/src/lib/billing/plan-catalog.ts`, the rewritten
`POST /api/billing/checkout`, the new `POST /api/billing/plan-change/{preview,confirm,cancel-scheduled}`
routes, the webhook's price→plan resolution, the scheduled-downgrade cron sweep, checkout
continuity through `/sign-in`, the public `/pricing` page, and the Super Admin catalog/subscription
views. It does not re-review Phase 5 (audit conversion, `isSafeRelativeRedirect`, continuation
records — see `PHASE_05_AUDIT_CONVERSION_THREAT_REVIEW.md`) or the underlying webhook
signature/idempotency machinery from Part 2 (`BILLING_SECURITY.md`), both unchanged in mechanism —
this document re-verifies they still hold under the new price model where relevant, but does not
redesign them.

Threats are grouped by the required list; each entry states the concrete attack, the actual
mitigating code, and — where one exists — the residual risk left open and why it's accepted.

## 1. Client-controlled price, amount, or currency

**Threat**: a tampered client sends a Paddle price ID, a raw dollar amount, or a currency code
directly, bypassing the real catalog.

**Mitigation**: `POST /api/billing/checkout` and both `POST /api/billing/plan-change/{preview,confirm}`
accept only `{ planId: enum("solo"|"pro"|"agency"), interval: enum("month"|"year") }` — there is no
price-ID, amount, or currency field in any of the three request schemas
(`apps/web/src/pages/api/billing/checkout.ts:14-17`,
`.../plan-change/preview.ts:13-16`, `.../plan-change/confirm.ts:14-17`). The real Paddle price ID
is always resolved server-side from `plan_prices` via `resolveCheckoutPrice()`
(`apps/web/src/lib/billing/plan-catalog.ts:163-187`), which only ever returns a row matching the
caller's own `(planId, interval, environment)` with `active_for_new_checkout = true`. No code path
in `apps/web` reads a price ID or amount out of a request body and uses it directly.

## 2. Sandbox price used in production (or vice versa)

**Threat**: a production deployment accidentally checks a customer out against a sandbox Paddle
price (or a sandbox deployment against a live one), causing a broken checkout or, worse, a real
charge from a test environment.

**Mitigation**: every `plan_prices` row is scoped to one `environment` (`sandbox` | `production`,
`CHECK` constraint in migration `0021_plan_prices.sql`), and `resolveCheckoutPrice`/
`getPlanCatalogEntry` always filter on `env.PADDLE_ENVIRONMENT`, read from the Worker's own
`wrangler.jsonc` binding — never from a request. A client cannot influence which environment's
price is resolved. The Super Admin `/admin/plans` catalog view (`plan-catalog-status.ts`,
`computeCatalogStatusFlags`) additionally flags, at read time, any active-for-checkout mapping
missing for the _currently running_ environment, and `SubscriptionsManager.tsx`'s
`environmentMismatch` flag surfaces any subscriber whose stored `paddle_price_id` resolves to a
`plan_prices` row from the _other_ environment (e.g. a sandbox-created test subscriber whose row
somehow ended up live) — see `listSubscriptions()`'s left join in
`apps/web/src/lib/admin/subscriptions.ts`.

## 3. A legacy (retired) price accepted for new checkout

**Threat**: a new customer is checked out against a retired price, either getting an unintended
(and unadvertised) rate or triggering ambiguous entitlement resolution.

**Mitigation**: `resolveCheckoutPrice` filters on `active_for_new_checkout = true` unconditionally
— every legacy row in the seed data has `active_for_new_checkout = 0`
(`packages/database/seed/reference-data.sql`, the three `*_legacy` rows). A legacy price can only
ever be _resolved_ through `resolvePriceToPlan()` (webhook/admin-resync path, no
`active_for_new_checkout` filter — deliberately, so an existing subscriber's events keep working
forever), never through `resolveCheckoutPrice` (new-checkout path). See
`docs/billing/LEGACY_PRICE_AND_SUBSCRIBER_POLICY.md`. The admin catalog view additionally warns
(not just informs) if a `legacy = true` row is ever found with `active_for_new_checkout = true` —
a data-entry contradiction that should never occur but is now actively detected.

## 4. Free-plan checkout

**Threat**: a checkout request for `planId: "free"` — which has no Paddle price at all — either
crashes or silently succeeds with no charge and no real entitlement change.

**Mitigation**: `checkoutRequestSchema` and both plan-change schemas use
`z.enum(["solo", "pro", "agency"])` for `planId` — `"free"` fails Zod validation before any
resolution logic runs, returning `VALIDATION_FAILED`. `resolveCheckoutPrice`'s parameter type is
`PaidPlanId`, so even a bypassed schema could not compile a call with `"free"`.

## 5. Quantity manipulation

**Threat**: a modified client sends `quantity: 0`, a negative number, or a large number to the
Paddle Checkout overlay, trying to reduce or eliminate the real charge while still receiving the
subscription entitlement.

**Mitigation**: `CheckoutButton.tsx` hardcodes `items: [{ priceId, quantity: 1 }]` — there is no
UI control or server input that reaches this value. More importantly, the actual charge is
computed and enforced by Paddle's own backend when `Paddle.Checkout.open()` submits: the browser
can request whatever it wants, but the transaction total the customer is shown and actually
charged is Paddle's own, server-computed number, not a value CrawlPact ever trusts. On the
entitlement side, `handleSubscriptionEvent()` in `webhook-processor.ts` never reads `quantity` at
all — a plan grant is determined purely by which `price.id` the resulting subscription's first
item has (see §6), so a manipulated quantity has no entitlement effect either way; the only thing
a client could change is how much _they themselves_ are charged, bounded by whatever Paddle's own
checkout validation allows.

## 6. Unsupported line-item injection

**Threat**: a modified client adds an extra `items[]` entry to `Checkout.open()` — e.g. a second
product the client doesn't own — hoping the extra item is silently honoured for entitlement or
billing purposes.

**Mitigation**: `handleSubscriptionEvent()` reads only `items?.[0]?.price?.id`
(`webhook-processor.ts:172-173`) for plan resolution — any additional items in the resulting
Paddle subscription are structurally ignored by this app. An injected item can only affect what
Paddle actually bills the payer for (visible to them in Paddle's own checkout UI before they pay,
since Checkout is an interactive form, not a silent API call) — it cannot grant a different or
additional entitlement than what `items[0]`'s price maps to. **Residual, accepted**: this app does
not currently reject/flag a subscription whose Paddle-side item count is ever `!== 1` (it would
only ever be `1` through our own checkout flow); a future hardening could add that check to
`handleSubscriptionEvent`, but there is no known path for it to matter today, so it wasn't added.

## 7. Duplicate subscriptions for one account

**Threat**: a user (accidentally, via a double-click, two tabs, or intentionally) ends up with two
live Paddle subscriptions instead of one, causing double billing or ambiguous plan-change targets.

**Mitigation**: `billing_customers.user_id` is `UNIQUE` (migration `0003_billing.sql`) — a second
Paddle _customer_ created for the same CrawlPact account cannot get a second `billing_customers`
row; `findOrCreateBillingCustomer`'s `onConflictDoNothing()` (no explicit target, so it covers
either the `user_id` or `paddle_customer_id` unique constraint) silently no-ops the insert, and the
subsequent lookup-by-`paddle_customer_id` finds nothing, so the event is recorded as `failed`
rather than fabricating a second linkage. `subscriptions.paddle_subscription_id` is also `UNIQUE`,
so the same Paddle subscription can never produce two local rows regardless of concurrent webhook
delivery (§10 covers the race itself). **Residual, accepted**: nothing in this codebase prevents a
single `billing_customers` row from having two _different_ `paddle_subscription_id` rows pointing
at it (no `UNIQUE` on `subscriptions.billing_customer_id`) — this can only happen if Paddle itself
is told to create two subscriptions for one customer, which our checkout flow never does
intentionally, but isn't structurally impossible on Paddle's side (e.g. support-assisted
double-purchase). `getActiveSubscriptionContext` takes `.limit(1)` on the first match, which is not
guaranteed deterministic if this ever occurs. This exact condition is now visible in the enhanced
`/admin/subscriptions` view (every row for a given user's `billingCustomer` is listed, un-deduped),
so it is detectable, not silently mishandled — but not structurally prevented at the DB layer. See
`docs/status/KNOWN_RISKS.md`.

## 8. Simultaneous/concurrent checkouts

**Threat**: two concurrent `POST /api/billing/checkout` requests for the same user race each other.

**Mitigation**: this endpoint is read-only against local state (it only resolves a price and
returns it — no row is written). Two concurrent calls simply return the same resolved price
independently; there is no shared mutable state to race over. Any resulting duplicate _Paddle_
subscription is covered by §7.

## 9. Checkout-callback forgery

**Threat**: a forged client-side "checkout completed" event is used to grant an entitlement
without a real payment.

**Mitigation**: there is no such callback in this codebase. `CheckoutButton.tsx` calls
`paddle.Checkout.open(...)` and does not register `.on("checkout.completed", ...)` or any other
Paddle.js event handler — no client-reported completion state is read or trusted anywhere. The
`checkout_completed_client` name exists in `PRODUCT_EVENT_NAMES` (reserved for a future analytics
wiring) but nothing currently fires it and nothing consumes it for entitlement purposes. The only
way an entitlement is ever granted is a verified `subscription.updated`/`subscription.created`
webhook (§10-13), which Paddle sends server-to-server, never through the browser.

## 10. Webhook signature bypass or replay

**Unchanged from Part 2, re-verified.** `verifyPaddleWebhookSignature()`
(`apps/web/src/lib/billing/paddle-webhook.ts`) computes HMAC-SHA256 over `${ts}:${rawBody}` using
the timing-safe `timingSafeEqualHex`, rejects a missing/malformed header, and rejects any
timestamp more than 5 minutes (`MAX_SIGNATURE_AGE_SECONDS`) old or in the future — closing the
replay window. Verified against real, Paddle-signed production traffic on 2026-07-28 (see
`docs/status/PADDLE_WEBHOOK_LIVE_DELIVERY_VERIFICATION.md`). Phase 6 did not touch this file.

## 11. Event-order race (a stale event reverting newer state)

**Unchanged mechanism, re-verified compatible with the new price columns.**
`handleSubscriptionEvent`'s `UPDATE ... WHERE last_applied_occurred_at IS NULL OR
last_applied_occurred_at < event.occurred_at` (`webhook-processor.ts:226-247`) is a single
atomic compare-and-swap — a late-arriving older event's `UPDATE` matches zero rows and is recorded
as `ignored_out_of_order`, never applied. This now also guards the new `paddle_price_id` and
`billing_interval` columns, since they're set inside the same guarded `UPDATE` — a stale event
cannot roll a subscriber's price/interval backwards any more than it can roll their status
backwards.

## 12. Duplicate event processing

**Unchanged.** `processPaddleWebhookEvent`'s `webhook_events.paddle_event_id` `UNIQUE` lookup
short-circuits to `"duplicate"` for any event already `processed`/`ignored`/`permanently_failed`
(`webhook-processor.ts:451-458`) — a replayed delivery is a 200 no-op, never a double-grant.

## 13. Subscription state rollback

Same mechanism as §11 — the CAS guard is on the subscription row's `last_applied_occurred_at`
regardless of _which_ fields an event changes, so this covers status, plan, price, and interval
uniformly; there is no separate rollback vector introduced by adding two new columns to the same
guarded row.

## 14. Cross-account linking via forged `custom_data.userId`

**Threat**: a modified client overwrites `customData.userId` passed to `Paddle.Checkout.open()`
before the call, trying to link the resulting subscription to a different account than the one
that authenticated the checkout request.

**Mitigation, existing accounts**: `billing_customers.user_id` is `UNIQUE`. If the forged
`userId` belongs to an account that already has a `billing_customers` row (i.e. any existing
subscriber, past or present), `findOrCreateBillingCustomer`'s insert conflicts on that constraint,
`onConflictDoNothing()` no-ops it, the subsequent lookup by `paddle_customer_id` (a _new_ Paddle
customer, since this is a fresh checkout) finds nothing, and the webhook is recorded as `failed`
with no linkage created. **Residual, accepted, low severity**: for a victim account that has
_never_ subscribed before (no existing `billing_customers` row), a forged `userId` naming that
account, combined with the attacker actually completing a real, self-paid Paddle checkout, would
succeed in linking the resulting subscription to the victim's account — i.e. the attacker pays
real money to upgrade a stranger's account. This requires the attacker to know a specific
internal user ID (a non-guessable UUID, never exposed in any public page or API response) and to
spend real money with no benefit to themselves; there is no privilege-escalation, data-exposure,
or free-upgrade path here for the attacker. Accepted without further mitigation; documented rather
than silently left unexamined.

## 15. Open redirect (checkout continuity)

**Threat**: the new `?plan=&interval=` query parameters on `/sign-in`, carried through from
`/pricing`, are used to build an unsafe redirect target.

**Mitigation**: `requestedPlan`/`requestedInterval` are validated against closed `Set`
allowlists (`PAID_PLAN_IDS`, `BILLING_INTERVALS` in `sign-in.astro:20-31`) before use — an
unrecognised value is discarded, never interpolated. The resulting `redirectTo` is always the
fixed shape `` `/app/billing?plan=${requestedPlan}&interval=${requestedInterval}` `` built from
those validated enum members, then passed through the existing `isSafeRelativeRedirect()`
(Phase 5) before being trusted at all — the same defence-in-depth pattern as the Phase 5
continuation redirect. `PricingPlans.tsx`'s `ctaHref()` similarly only ever interpolates
`plan.id` (from the server-rendered catalog, never client input) and the two-value `interval`
toggle state — there is no code path where an arbitrary string reaches a `href` or redirect.

## 16. Customer-portal URL leakage

**Threat**: the Paddle-hosted billing-portal URL (which itself grants portal access) is logged,
cached, or exposed to a party other than the authenticated owner.

**Mitigation**: `POST /api/billing/portal-session` (unchanged from Part 2, re-verified) requires
`requireSession()`, looks up the caller's _own_ `billing_customers` row by their own `user.id`
(never a caller-supplied ID), calls Paddle fresh on every request (no caching, no persistence of
the URL anywhere in D1), and returns it once in a JSON response consumed immediately by
`PortalButton.tsx` via `window.location.href = body.data.url` — never rendered as a visible link,
never included in an analytics event, never logged. Phase 6 did not change this route.

## 17. Admin entitlement override

**Threat**: a Super Admin action (resync, catalog view) accidentally or maliciously grants an
entitlement outside the webhook-only chokepoint.

**Mitigation**: `resyncSubscription()` (updated in Phase 6 to also persist `paddlePriceId`/
`billingInterval`) writes only to the `subscriptions` table — it has never, before or after this
phase, written to `users.plan_id`. The only two ways `users.plan_id` can change are (a) a verified
webhook event (§10-13) or (b) `grantTemporaryEntitlement`/`revokeTemporaryEntitlement`
(`apps/web/src/lib/admin/subscriptions.ts`), both of which run exclusively through
`requireAdminAction` — step-up re-authentication, a mandatory ≥3-character `reason`, a dedicated
60/hour rate limit, and a self-writing audit-log entry (`apps/web/src/pages/api/admin/AGENTS.md`).
Phase 6 added no new write path to `users.plan_id`.

## 18. Price-mapping drift (DB vs. live Paddle catalog)

**Mitigation**: `computeCatalogStatusFlags()` (`apps/web/src/lib/admin/plan-catalog-status.ts`),
surfaced on `/admin/plans`, flags missing mappings (a paid plan/interval/environment combination
with zero active rows), duplicate mappings (more than one active row for the same combination),
non-unique Paddle price IDs across rows, a legacy price still marked active for new checkout, and
an archived price that still has live subscribers on it — computed fresh from the DB on every page
load, not cached. **Pending**: a read-only `pnpm paddle:catalog:verify` command that additionally
reconciles the DB against a live Paddle API read (catching drift the DB alone can't see, e.g. a
price archived in Paddle but not marked `archived_at` locally) is tracked as a separate, not-yet-
built Phase 6 deliverable — see the roadmap/completion report for status.

## 19. Secret or API-key exposure

**Mitigation**: `PADDLE_API_KEY` and `PADDLE_WEBHOOK_SECRET` are read exclusively via `getEnv()`
(`apps/web/src/lib/env.ts`, which imports Cloudflare's `cloudflare:workers` binding — a
server-only module never bundled into client JS) and are used only inside server-side route
handlers/lib functions (`paddle-api.ts`, `paddle-webhook.ts`) — neither is ever passed to a
client component, embedded in a `<script>`, or included in an API response. The one Paddle
credential that _is_ sent to the browser, `PUBLIC_PADDLE_CLIENT_TOKEN`, is Paddle's own
publishable client-side token by design (documented as safe for public exposure in Paddle's own
integration model, analogous to a Stripe publishable key) — this is unchanged from Part 2.

## 20. Database race conditions

Covered by §7 (unique-constraint + `onConflictDoNothing` for customer/subscription/transaction
creation races) and §11/§13 (CAS on subscription updates). No new race class was introduced by the
two new nullable subscription columns or the new `plan_prices` table, which is read-only from the
application's perspective outside the (separately confirmed, MCP-driven) catalog-write process.

## 21. Plan-change CSRF

**Threat**: a cross-origin page tricks a logged-in victim's browser into submitting a plan-change
request.

**Mitigation**: all three plan-change routes (`preview`, `confirm`, `cancel-scheduled`) call
`requireSession()`, whose `assertSameOrigin()` (`apps/web/src/lib/auth/require-session.ts`)
rejects any mutating request whose `Origin`/`Referer` doesn't match the app's own origin — the
same protection every other authenticated mutation in this app relies on (unchanged mechanism,
newly applied to three new routes). `confirm` and `cancel-scheduled` both mutate state;
`preview` does not (§ "read-only" note in its own doc comment) but still requires a session so it
can't be used to fingerprint an arbitrary account's subscription state anonymously.

## 22. Proration-preview / actual-charge mismatch

**Threat**: the proration total shown to the customer in `PlanChangeButton`'s confirmation step
(from `previewSubscriptionUpdate`) is stale or manipulable by the time they click "Confirm,"
leading to a charge that doesn't match what was displayed.

**Mitigation**: the preview figure is never trusted as the authoritative charge — it exists purely
as UI copy. `confirmPlanChange()` makes its own independent call to
`updateSubscriptionItem(..., "prorated_immediately")` (`plan-change.ts:203-208`), which is the
actual mutating Paddle API call; Paddle computes the real proration at that moment, from its own
live state, regardless of what an earlier `preview` call returned. If the two figures differ
(e.g. the customer waited between preview and confirm and something changed), the customer is
charged whatever Paddle's real-time computation produces — never a client-cached or previously
displayed number — and the actual entitlement grant still only happens via the resulting
`subscription.updated` webhook (§17), not from either API response directly.

## What Phase 6 deliberately did not change

Webhook signature verification, replay protection, and the CAS/idempotency machinery (§10-13) are
Part 2 mechanisms, re-verified here against the new price columns but not redesigned. The
customer-portal flow (§16) and the admin audit-log/step-up-auth chokepoint (§17) are unchanged.
No trial, discount, seat-pricing, add-on, or country-price-override logic was added — none of the
above threats apply to functionality this phase deliberately does not build (see
`docs/billing/APPROVED_PRICING_AND_ENTITLEMENT_MATRIX.md`'s explicit "absent" list).
