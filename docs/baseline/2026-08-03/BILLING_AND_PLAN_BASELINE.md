# Billing and Plan Baseline — 2026-08-03

Phase 0 baseline. Read-only code inspection only — no live Paddle API call was made by this
document's underlying research beyond the separate, explicitly read-only MCP calls recorded in
`PRODUCTION_INFRASTRUCTURE_INVENTORY.md` §6. No billing config, product, price, customer,
subscription, or transaction was created or modified.

## 1. Plan catalog — three sources, one canonical data source

1. **SRS §8** (`docs/product/CRAWLPACT_FINAL_SRS.md:506-523`) — authoritative plan table; explicitly
   requires: "Plan definitions and entitlements shall be stored in the database and shall not be
   permanently hard-coded into the frontend" (line 523).
2. **Migration `0001_plans.sql`** — schema only, no data.
3. **`packages/database/seed/reference-data.sql:39-49`** — the actual data source (`INSERT OR
IGNORE`), explicitly commented "exact values, matching migrations/0001_plans.sql," and the same
   file whose prior absence in production caused the account-registration outage described in
   `docs/status/IMPLEMENTATION_STATUS.md`.

### Plan values as seeded

| Field                       | Free  | Solo    | Pro    | Agency |
| --------------------------- | ----- | ------- | ------ | ------ |
| Annual price (USD cents)    | 0     | 7,900   | 17,900 | 39,900 |
| Saved-domain limit          | 1     | 5       | 25     | 100    |
| Monitoring frequency        | none  | monthly | weekly | weekly |
| History retention (days)    | 30    | 365     | 730    | 1095   |
| Manual rescans/domain/month | 2     | 5       | 10     | 20     |
| Domain groups               | no    | no      | yes    | yes    |
| CSV export                  | no    | no      | yes    | yes    |
| Print-ready report tier     | basic | full    | full   | full   |
| Private Atom feed           | no    | yes     | yes    | yes    |
| Batch import limit          | 0     | 0       | 10     | 100    |
| Agency branding             | no    | no      | no     | yes    |

Confirmed live against the actual Paddle catalog this session (see
`PRODUCTION_INFRASTRUCTURE_INVENTORY.md` §6) — all three paid amounts match exactly, and **annual
billing only** (no monthly price exists anywhere: not in the schema, not in the seed data, not in
the live Paddle catalog). This is a deliberate spec decision (SRS §9.16 explicitly requires
showing annual prices), not a gap.

## 2. Central plan-mapping and entitlement-resolution code

- `apps/web/src/lib/billing/plan-mapping.ts` — Paddle price-ID ↔ plan-ID translation only
  (`mapPriceIdToPlanId`, `priceIdForPlan`). Does not carry limits/entitlements.
- `apps/web/src/lib/plan.ts` — `getPlan(db, planId)` is the **single declared entitlement
  chokepoint**; docstring: "Every entitlement check... reads from here — never hard-code a limit
  inline."
- Paddle subscription state → `users.plan_id`: `webhook-processor.ts`'s `applyPlanFromStatus` —
  `active`/`trialing` grants the plan; `past_due` leaves plan unchanged (grace period, no
  revocation); `cancelled`/`expired`/`paused` forces `plan_id` back to `"free"`.
- A second, independent path exists for admin-granted temporary overrides
  (`apps/web/src/lib/admin/subscriptions.ts`: `grantTemporaryEntitlement`/
  `revokeTemporaryEntitlement`/`resolveRealEntitledPlan`).

## 3. Checkout and customer-portal routes

| Route                              | Behavior                                                                                                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/billing/checkout`       | Authenticated; validates `{planId}`; returns `{priceId, customData:{userId}, clientToken, environment}` for Paddle.js's client-side overlay checkout — never calls Paddle's API itself.                                                                       |
| `POST /api/billing/portal-session` | Authenticated; requires an existing `billing_customers` row; calls Paddle's real API server-to-server to mint a portal session URL.                                                                                                                           |
| `/app/billing` dashboard           | Server-rendered; shows plan, subscription status, past-due/scheduled-cancellation notices, domain usage vs. limit, portal button, and a 3-card plan grid where every non-current plan is labelled **"Upgrade to X" regardless of tier direction** (see §5.3). |

## 4. Webhook endpoint (`/api/billing/webhook`)

- **Signature verification**: HMAC-SHA256 over `${ts}:${rawBody}` via Web Crypto, timing-safe
  compare, 5-minute max signature age, verified against real Paddle-signed production traffic
  2026-07-28.
- **Idempotency**: keyed on `webhook_events.paddle_event_id` (unique); duplicate
  processed/ignored/permanently-failed events short-circuit; `pending`/`failed`/`retrying` events
  genuinely reprocess; max 5 attempts before `permanently_failed`. Out-of-order events (by
  `occurred_at`) are recorded as `ignored_out_of_order`, never applied backwards. Race conditions
  between near-simultaneous related events handled via `.onConflictDoNothing()` + recursive
  re-query.
- **Subscribed/dispatched event families**: `subscription.*`, `transaction.*`, `adjustment.*`
  (refund/chargeback), `customer.*` — matches the live Paddle notification destination's
  subscribed-event list exactly (confirmed this session, see infra inventory §6.1).
- **Data minimisation**: `custom_data` is stripped before the payload is persisted
  (`redactPayload`) — a documented trade-off: a retried event that needed `custom_data.userId` for
  its very first linkage cannot recover it from stored data alone.

## 5. Upgrade / downgrade / cancellation / refund / past-due

| Scenario              | Status                                                                                                                                                                                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upgrade               | Partially coded — `CheckoutButton` opens a new Paddle Checkout for the target price. Whether Paddle's own flow performs an in-place item swap vs. a second subscription for an already-subscribed customer is **not verified — a live paid checkout run was out of scope**.                                                                       |
| Downgrade             | Same code path as upgrade; **UI labels every non-current plan "Upgrade to X" regardless of actual tier direction** — a real wording inaccuracy (e.g. a Pro user sees "Upgrade to Solo"). No server-side "change existing subscription" call exists anywhere in the repo.                                                                          |
| Cancellation          | Coded via Paddle's hosted portal only (no in-app cancel action). Webhook side correctly distinguishes a _scheduled_ cancellation (`cancel_at_period_end=true`, access not yet revoked) from an _effective_ one (status → `cancelled`, access revoked). Both paths covered by integration tests.                                                   |
| Refund / chargeback   | Coded (`handleAdjustmentEvent`); refund path has an integration test; a dedicated chargeback-specific test was **not confirmed** (test-by-test read was out of scope). Adjustment `action` field-shape is flagged "best-effort" in the code's own docstring — cross-checked against documented shape, not against a real Paddle-triggered refund. |
| Past-due              | Coded, correct grace period (plan untouched, "Payment past due" UI banner shown), covered by an integration test.                                                                                                                                                                                                                                 |
| Admin manual override | Fully coded, separate from Paddle, requires expiry + reason, tested.                                                                                                                                                                                                                                                                              |
| Admin Paddle resync   | Coded, real API call, honestly records a sync error on failure rather than fabricating success. The file's own docstring claiming "no sandbox credentials available" is now **stale** relative to the live Paddle account established since 2026-07-26 — a documentation-vs-reality gap, not fixed here.                                          |

## 6. Plan consistency check — inconsistencies found (not fixed)

1. **`pricing.astro` hard-codes a duplicate plan array** instead of reading the `plans` table —
   exactly the pattern SRS §8 forbids ("shall not be permanently hard-coded into the frontend").
   Values currently match the DB seed, but nothing enforces they stay in sync.
2. **Batch-import wording gap**: SRS §8 states Agency batch import as unqualified "Yes"; the
   actual seeded limit is a bounded **100**. Not a hard contradiction, but "Yes" could mislead a
   reader into believing it's uncapped.
3. **History retention units ambiguity**: SRS states months (12/24/36); schema/seed store days
   (365/730/1095) — internally consistent under a 365-day-year convention, but that conversion
   rule is undocumented anywhere found.
4. **`packages/core/src/api/contracts/billing.ts` does not match the real implementation at all**
   — its `createCheckoutRequestSchema` expects field `plan` (real route uses `planId`); its
   response schema expects `checkoutUrl` (the real client-side-overlay flow returns
   `{priceId, customData, clientToken, environment}` — no `checkoutUrl` field exists anywhere in
   the real implementation). The file is still annotated "Not implemented in Part 1" — stale, since
   billing is fully implemented. Confirmed **entirely unused/dead code**: zero references to its
   exported schemas anywhere outside the file itself. This is the most concrete inconsistency
   found — a "canonical" contract module describing an API shape that was never built.
5. Paddle price-ID env-var names are consistent everywhere checked (`plan-mapping.ts`,
   `checkout.ts`, `webhook.ts`, `admin/subscriptions.ts`, `.env.example`) — no conflict.
6. Entitlement-check code (`lib/plan.ts`) has a single, un-duplicated source of truth — no
   conflict found here.
7. Super Admin plan presentation is read-only, DB-sourced, and explicitly self-disclaims
   ("pricing/entitlement changes are a product decision made in a migration, not an ad-hoc admin
   edit") — consistent with no `PUT`/`PATCH` plans route existing anywhere.

## 7. Existing billing tests

`billing-webhook.integration.test.ts` (12 scenarios: invalid signature, subscription create/renew,
past-due grace, scheduled/effective cancellation, duplicate no-op, out-of-order ignored,
transaction+refund, unhandled type acknowledged, draft-without-customer ignored, concurrent race);
`admin-billing.integration.test.ts` (7 scenarios: entitlement grant/revoke/mismatch-detection,
resync honest-failure, non-admin rejection); `admin-webhooks.integration.test.ts` (7 scenarios:
failed-webhook storage/listing/retry rules/non-admin rejection); a unit-level
`paddle-webhook.test.ts` for signature verification (existence confirmed, not opened in full). No
route-level test was found covering `/api/billing/checkout` or `/api/billing/portal-session`
directly — **not verified** whether one exists beyond this grep-based pass.

## 8. Existing billing-related known risks (pointer only)

Already logged in `docs/status/KNOWN_RISKS.md`: no real _paid_ checkout lifecycle has ever been
run (deliberately, requires separate authorization); the Paddle webhook secret is returned in
plaintext by Paddle's own API response shape and has not been rotated. This audit adds two new
findings not previously captured: the dead `packages/core` billing contract (§6.4) and the
downgrade-labelling UI gap (§5).

## 9. Verification limitations

- Whether Paddle's client-side checkout, reopened by an already-subscribed customer for a
  different price, performs an in-place upgrade/downgrade or a second parallel subscription —
  **not verified — a live paid checkout run was outside this pass's authorized scope.**
- A dedicated chargeback-specific integration test was not confirmed to exist.
- Whether `docs/deployment/PADDLE_LIVE_CONFIGURATION.md`'s stated product/price IDs still matched
  the real account **has since been independently confirmed live** this session (see
  `PRODUCTION_INFRASTRUCTURE_INVENTORY.md` §6) — they do.
