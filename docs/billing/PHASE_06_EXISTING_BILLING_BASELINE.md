# Phase 6 existing billing baseline

Captured before any Phase 6 code or Paddle catalog change, from a combination of direct
repository inspection and read-only Paddle MCP calls against the connected account. See
`docs/billing/PADDLE_LIVE_PREFLIGHT_CHANGE_MANIFEST.md` for the planned changes this baseline
feeds into, and `docs/reports/PHASE_06_PRICING_PADDLE_CHECKOUT_COMPLETION_REPORT.md` for what
actually happened.

## Environment identity verification

The Paddle MCP connection was cross-checked against three independent pieces of evidence already
present in the repository, all of which matched exactly:

| Evidence          | Repository value (`apps/web/wrangler.jsonc`, production `vars`)   | Paddle MCP live read                                                                                                   |
| ----------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Client-side token | `PUBLIC_PADDLE_CLIENT_TOKEN = "live_7744585ebeca2976cd76da4b966"` | `clientTokens.list()` returned a token `live_7744585ebeca2976cd76da4b966` named "CrawlPact production web"             |
| Solo price ID     | `PADDLE_PRICE_ID_SOLO = "pri_01kyfjzj3t4x2t4dqrmnkjj0r2"`         | `products.list({include:["prices"]})` returned this exact price ID on the active "CrawlPact Solo" product, $79.00/year |
| Pro price ID      | `PADDLE_PRICE_ID_PRO = "pri_01kyfjzj81k6w2ds6r6a2jcv93"`          | Matched, $179.00/year                                                                                                  |
| Agency price ID   | `PADDLE_PRICE_ID_AGENCY = "pri_01kyfjzjc4tbhve9czw1dq2b1b"`       | Matched, $399.00/year                                                                                                  |

Additionally, `notificationSettings.list()` returned exactly one destination:
`https://crawlpact.com/api/billing/webhook` (matches the real production webhook route),
active, and `checkoutDomains.list()` returned exactly one approved domain: `crawlpact.com`.

**Conclusion: this MCP connection is unambiguously the same live Paddle account backing
production.** No sandbox/live ambiguity exists for this phase.

## Current live Paddle catalog (as read, before any Phase 6 change)

**Active products/prices** (what production actually checks out against today):

| Product          | Product ID                       | Price ID                         | Amount      | Interval | Trial |
| ---------------- | -------------------------------- | -------------------------------- | ----------- | -------- | ----- |
| CrawlPact Solo   | `pro_01kyfjzj2pte9mcgyg4f3smpem` | `pri_01kyfjzj3t4x2t4dqrmnkjj0r2` | $79.00 USD  | year     | none  |
| CrawlPact Pro    | `pro_01kyfjzj6xdb6he6mygawd165n` | `pri_01kyfjzj81k6w2ds6r6a2jcv93` | $179.00 USD | year     | none  |
| CrawlPact Agency | `pro_01kyfjzjb29p9y2ebtbxzx6nkv` | `pri_01kyfjzjc4tbhve9czw1dq2b1b` | $399.00 USD | year     | none  |

**Archived products/prices** (an earlier, richer iteration — already archived before this phase,
not currently reachable from checkout, but still real catalog history):

| Product          | Product ID                       | Price ID                         | Amount      | Interval | Notes                                                   |
| ---------------- | -------------------------------- | -------------------------------- | ----------- | -------- | ------------------------------------------------------- |
| CrawlPact Solo   | `pro_01kyd001j1gt10c04akk8gng10` | `pri_01kyd001vg1ffsx9yg5frnvda2` | $79.00 USD  | year     | Had GBP/EUR/AUD country overrides, richer `custom_data` |
| CrawlPact Pro    | `pro_01kyd00251gxfn0mfbhp8x07he` | `pri_01kyd002z1xjv4jxa92zj1a64y` | $179.00 USD | year     | Same                                                    |
| CrawlPact Agency | `pro_01kyd003b4j41583tdkmvrqf5v` | `pri_01kyd003jtw9tx21kjfmzsah42` | $399.00 USD | year     | Same                                                    |

None of the six existing prices have a trial period configured. No monthly price exists anywhere
in the live catalog today.

## Existing production subscribers (aggregate, redacted)

A direct, read-only, aggregate-only query against the real production D1 database
(`SELECT plan_id, status, COUNT(*) ... GROUP BY plan_id, status`) returned exactly **one** row:

| Plan | Status | Count |
| ---- | ------ | ----- |
| solo | active | 1     |

That single subscriber already has `cancel_at_period_end = true` (current period ends
2027-07-28) — they are already scheduled to roll off to Free naturally and require no active
migration. No customer PII (name, email, Paddle customer ID) was read or recorded anywhere in
this baseline or elsewhere in this phase's documentation.

## Current application architecture (before Phase 6)

- **Plan/pricing data has two independent, same-named-but-incompatible `Plan` types**:
  - `apps/web/src/lib/plans.ts` — a file-constant array (4 entries) driving the public `/pricing`
    page and the homepage pricing preview. Its own doc comment already flags this as Phase 6's
    scope to fix. Annual-only; no billing-interval field exists on the type at all.
  - `apps/web/src/lib/plan.ts`'s `getPlan()` — reads the real `plans` DB table
    (`packages/database/src/schema/plans.ts`), used by all 13 real entitlement-gating call sites
    across the codebase. This is the actual entitlement source of truth and is unaffected by the
    marketing-copy duplication above.
- **The `plans` DB table's entitlement columns already match the Phase 6 approved matrix
  exactly** (see `docs/billing/APPROVED_PRICING_AND_ENTITLEMENT_MATRIX.md`) — confirmed against
  `packages/database/seed/reference-data.sql`'s real seed values. Only the pricing representation
  (`annual_price_usd_cents`, a single annual-only column) needs to change; entitlement values
  themselves need zero changes.
- **Checkout has no billing-interval concept anywhere**: `POST /api/billing/checkout` accepts
  only `{ planId }`, resolves exactly one Paddle price ID per plan via 3 flat env vars
  (`apps/web/src/lib/billing/plan-mapping.ts`), and opens a client-side Paddle.js overlay. It
  never calls Paddle's API server-to-server itself.
- **No plan/interval survives a sign-in round trip.** Every pricing-page CTA links to plain
  `/sign-in` with no query parameter. Checkout only happens after sign-in, from `/app/billing`.
  The only existing continuation mechanism (Phase 5's `audit_continuations`) carries anonymous
  scan/domain intent, not plan selection — a different, unrelated concept.
- **No plan upgrade/downgrade endpoint exists.** `apps/web/src/pages/app/billing/index.astro`
  labels every non-current paid plan "Upgrade to X" regardless of actual tier direction
  (confirmed defect, tracked as RISK-017) — clicking it just opens a brand-new checkout for that
  plan's price, not an in-place Paddle subscription update. No call to Paddle's
  `subscriptions.update` API exists anywhere in the repo.
- **Cancellation and payment-method management are fully delegated to Paddle's hosted customer
  portal** (`POST /api/billing/portal-session` → `createCustomerPortalSession()` in
  `apps/web/src/lib/billing/paddle-api.ts`, itself flagged in its own doc comment as
  "UNVERIFIED against a live Paddle account"). No custom in-app cancel action exists.
- **Webhook processing is solid and must not regress**: real signature verification
  (HMAC-SHA256, 5-minute replay window), an idempotency ledger (`webhook_events`, keyed by
  Paddle event ID), and — critically — a compare-and-swap on `subscriptions.last_applied_occurred_at`
  that closes a real, previously-shipped out-of-order-delivery bug (see
  `docs/status/BILLING_WEBHOOK_RACE_TEST_FLAKE.md`). Event-type routing is prefix-based
  (`subscription.*`/`transaction.*`/`adjustment.*`/`customer.*`); all 24 event types currently
  live-subscribed in Paddle are routed to a handler, though `adjustment.*` only understands
  `refund`/`chargeback` actions (a credit adjustment is silently dropped — a pre-existing, minor
  gap this phase does not need to fix, since Phase 6 introduces no discount/credit feature).
- **`packages/core/src/api/contracts/billing.ts` is confirmed dead code** (RISK-016) — zero
  references anywhere outside the file, and its shapes (`plan` field, `checkoutUrl` response)
  don't match the real `planId`/`{priceId,customData,clientToken,environment}` implementation at
  all.
- **Super Admin** has a read-only `/admin/plans` catalog view and a `/admin/subscriptions`
  manager with one action (resync from Paddle) — no plan-change, cancel, or refund action exists
  there, by design (`admin/plans/index.astro`'s own copy: "Pricing/entitlement changes are a
  product decision made in a migration, not an ad-hoc admin edit"). Its subscriber list uses an
  `INNER JOIN` to `users` that hides rows for later-deleted accounts (RISK-009, pre-existing,
  out of Phase 6's scope unless touched incidentally).
- **Structured pricing data** (`pricing.astro`'s inline `WebApplication`/`Offer` JSON-LD) is
  already dynamically derived from `plans.ts` (not a second hand-typed copy), but every offer's
  `priceSpecification.billingDuration` is hard-coded `"P1Y"` — needs a monthly offer added
  alongside.
- **Analytics** already has three billing-relevant event names reserved in
  `PRODUCT_EVENT_NAMES`: `pricing_viewed` (confirmed actually firing today, via
  `AnalyticsBeacon` on `/pricing`), `checkout_started`, `subscription_activated` (existence
  confirmed; whether the latter two actually fire anywhere was not confirmed in this baseline and
  is checked directly during implementation).
- **No `paddle`-prefixed npm script exists** — the live catalog's initial 2026-07-26 creation was
  done via a Paddle-catalog-setup skill run, not a repeatable script. Phase 6 adds the first real
  `paddle:catalog:verify`/`paddle:catalog:sync` commands.

## Pre-existing risks this phase directly targets

Quoted from `docs/risks/ACTIVE_RISKS.md` (all four already explicitly targeted at "Phase 6"):

- **RISK-001** — real paid Paddle checkout lifecycle never run.
- **RISK-012** — `billing-webhook.integration.test.ts`'s concurrent-race test flakes under load.
- **RISK-016** — dead `packages/core/src/api/contracts/billing.ts` contract.
- **RISK-017** — billing dashboard mislabels every plan change as "Upgrade to X".

RISK-002 (a one-time webhook-secret plaintext exposure, targeted at Phase 12) and RISK-009
(admin `INNER JOIN` hiding deleted accounts, targeted at Phase 11) are noted but are **not** in
this phase's scope — they remain targeted at their existing later phases.
