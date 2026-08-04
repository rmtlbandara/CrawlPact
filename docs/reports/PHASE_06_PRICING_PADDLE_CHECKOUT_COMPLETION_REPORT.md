# Phase 6 — Pricing, Plan Architecture and Checkout Continuity — Completion Report

Branch based on `main` at `4b5efe2` (Phases 0-5 merged and deployed to production 2026-08-04).

## Executive summary

Before this phase, pricing was fundamentally single-source-broken: `pricing.astro` used a
hard-coded plan array (an SRS §8 violation), the only Paddle prices that existed were 3 flat
annual-only prices routed through env vars, no monthly billing existed at all, no interval concept
existed anywhere in checkout, no upgrade/downgrade endpoint existed (the billing dashboard could
only ever open a brand-new checkout), the downgrade UI mislabelled every plan change as an
"Upgrade" regardless of actual direction (RISK-017), and a dead contract file
(`packages/core/src/api/contracts/billing.ts`, RISK-016) described an API shape that was never
built. `docs/billing/PHASE_06_EXISTING_BILLING_BASELINE.md`, written before any Phase 6 code
changed, confirmed all of this in detail.

This phase replaces the flat env-var price mapping with a DB-backed, multi-interval,
multi-environment pricing catalog (`plan_prices`, migration `0021_plan_prices.sql`) that every
consumer — the public pricing page, checkout, plan-change, the webhook processor, and Super Admin
— now reads from as the single source of truth. Six new monthly/yearly Solo/Pro/Agency prices were
created live in Paddle's production account under a documented preflight/idempotency process,
alongside the 3 pre-existing annual prices preserved as legacy, never-offered-for-new-checkout
mappings. A real upgrade/downgrade/billing-cycle-change flow was built end to end, using Paddle's
real proration-preview API and fixing the downgrade-mislabelling defect. Checkout continuity
carries a visitor's plan/interval choice through sign-up without ever trusting the browser for
price resolution. Both dead-code risks this phase specifically targeted (RISK-016, RISK-017) are
closed.

**What this phase did not do, deliberately**: no real, paid Paddle checkout was run. Per the
standing prohibition on triggering a real charge without separate, explicit authorization, this
phase verified the live catalog (real prices created and read back from Paddle), checkout-opening
(server-side price resolution against that real catalog), and webhook processing (against the new
price model) — but not an actual payment. RISK-001 remains open. No trial, discount, seat-pricing,
add-on, or country-price-override logic was added, and no public country wording was
reintroduced — all explicitly prohibited by this phase's own prompt. The SRS §2.3 tagline
reconciliation (RISK-028) and the `package.json` description-field gap, both carried forward from
Phase 5, were again not addressed — this phase's own execution prompt scoped it specifically to
pricing/checkout, same pattern as every prior phase this backlog has passed through (see
`docs/governance/GITHUB_GOVERNANCE_SETUP_MANIFEST.md`'s Phase 6 update).

## Starting point

`docs/billing/PHASE_06_EXISTING_BILLING_BASELINE.md` captured: environment-identity verification
(cross-checking the live Paddle MCP connection's client token/price IDs/webhook destination
against `wrangler.jsonc`'s hardcoded production values, conclusively proving it was the real
production account); the full live catalog at the time (3 active annual products/prices, 3
archived); the aggregate subscriber count (1 active Solo subscriber, `cancel_at_period_end=true`);
two incompatible `Plan` types in the codebase; no interval concept anywhere in checkout; no
upgrade/downgrade endpoint; cancellation fully delegated to Paddle's hosted portal; solid
CAS/idempotency webhook processing; `packages/core/src/api/contracts/billing.ts` confirmed fully
dead; Super Admin read-only with no plan-change/cancel/refund action; and structured pricing data
already dynamic but annual-only.

`docs/billing/APPROVED_PRICING_AND_ENTITLEMENT_MATRIX.md` recorded the exact authorized pricing
(Free $0; Solo $9/mo or $89/yr; Pro $19/mo or $189/yr; Agency $39/mo or $389/yr — Pro "Most
Popular") and confirmed the entitlement matrix required zero changes to match real seed data.

## Design decisions

Full reasoning in `docs/billing/{LEGACY_PRICE_AND_SUBSCRIBER_POLICY,
PLAN_CHANGE_AND_PRORATION_POLICY,CHECKOUT_CONTINUITY_ARCHITECTURE,
PADDLE_WEBHOOK_EVENT_MATRIX}.md` and `docs/security/PHASE_06_BILLING_AND_CHECKOUT_THREAT_REVIEW.md`;
summarised here:

- **DB-backed multi-interval catalog, not a bigger env-var block**: `plan_prices` allows an
  arbitrary number of historical rows per (plan, environment) combination — current and any number
  of legacy — which a fixed set of env vars structurally cannot represent. One row per real Paddle
  price, keyed by its own ID.
- **Legacy prices are never deleted or archived while subscribers remain on them** — marked
  `legacy=1, active_for_new_checkout=0` and resolved forever by the webhook path
  (`resolvePriceToPlan`, no active-for-checkout filter) but never by the new-checkout path
  (`resolveCheckoutPrice`, filtered).
- **Upgrade/downgrade direction is one ordered-pair comparison** `(planRank×10 +
intervalWeight)`, uniformly covering plan changes and billing-cycle changes — fixes RISK-017 with
  a single rule instead of two separate ones.
- **Scheduled downgrades are an application-level construct, not a native Paddle feature** —
  confirmed via the Paddle MCP schema search that `subscriptions.update`'s `scheduled_change`
  field can only ever be set to `null`. Implemented by recording intent locally and never calling
  Paddle until the effective date, which alone preserves current entitlements with no extra gating
  logic.
- **`users.plan_id` is never written by checkout or plan-change code** — only a verified webhook
  event grants an entitlement, per the pre-existing rule in
  `apps/web/src/pages/api/billing/AGENTS.md`, unchanged and re-verified by this phase's own tests.
- **Checkout continuity carries a semantic `(planId, interval)` pair only** — never a price ID or
  amount — reusing Phase 5's `isSafeRelativeRedirect()` and "read-only display hint, always
  re-validated server-side" pattern.
- **Prerendered pages never bake in live pricing**: `pricing.astro` moved from `prerender=true` to
  SSR (`prerender=false`) so it reads the live catalog per-request; the homepage's static pricing
  teaser was redesigned to show zero price/entitlement figures, sourcing only a marketing-copy
  constant, to avoid ever caching stale pricing into a static build.

## Live Paddle catalog change

Per `docs/billing/PADDLE_LIVE_PREFLIGHT_CHANGE_MANIFEST.md` (written and reviewed before any live
write) and executed only after explicit, in-the-moment user confirmation: 6 new production prices
created (Solo/Pro/Agency × monthly/yearly), each check idempotent (re-listed existing prices on
the target product immediately before creating, matched on `{currency, amount, interval,
frequency}`). Final state recorded in `docs/billing/PADDLE_LIVE_CATALOG_MAP.md` with exact Paddle
IDs, verified by an immediate readback. Nothing else in the live Paddle account was touched — the
3 pre-existing products, 3 legacy prices, notification destination, and checkout domain were all
reused as-is.

## Implementation files

**New:**

- `packages/database/migrations/0021_plan_prices.sql` + `packages/database/src/schema/{plans,
billing}.ts` (schema additions) — the `plan_prices` table and 5 new `subscriptions` columns.
- `apps/web/src/lib/billing/plan-catalog.ts` — the single source of pricing/entitlements/Paddle
  IDs (`getPlanCatalog`, `resolveCheckoutPrice`, `resolvePriceToPlan`).
- `apps/web/src/lib/billing/plan-change.ts` — `planChangeDirection`,
  `getActiveSubscriptionContext`, `previewPlanChange`, `confirmPlanChange`,
  `cancelScheduledPlanChange`.
- `apps/web/src/lib/billing/scheduled-downgrades.ts` — `applyDueScheduledDowngrades`, wired into
  `worker.ts`'s cron `scheduled()` handler.
- `apps/web/src/lib/admin/plan-catalog-status.ts` — `getPlanPriceCatalog`,
  `computeCatalogStatusFlags` (Super Admin catalog reconciliation).
- `apps/web/src/pages/api/billing/plan-change/{preview,confirm,cancel-scheduled}.ts`.
- `apps/web/src/components/app/{PlanChangeButton,BillingPlansSection}.tsx`,
  `apps/web/src/components/PricingPlans.tsx`.
- `scripts/paddle-catalog-verify.ts` (`pnpm paddle:catalog:verify`).
- `docs/billing/{PHASE_06_EXISTING_BILLING_BASELINE,APPROVED_PRICING_AND_ENTITLEMENT_MATRIX,
PADDLE_LIVE_PREFLIGHT_CHANGE_MANIFEST,PADDLE_LIVE_CATALOG_MAP,LEGACY_PRICE_AND_SUBSCRIBER_POLICY,
PLAN_CHANGE_AND_PRORATION_POLICY,CHECKOUT_CONTINUITY_ARCHITECTURE,PADDLE_WEBHOOK_EVENT_MATRIX,
PADDLE_CATALOG_RECONCILIATION_RUNBOOK,BILLING_DEPLOYMENT_AND_ROLLBACK_RUNBOOK}.md`
- `docs/security/PHASE_06_BILLING_AND_CHECKOUT_THREAT_REVIEW.md`
- `docs/analytics/PHASE_06_BILLING_EVENT_MODEL.md`

**Modified:**

- `apps/web/src/pages/api/billing/checkout.ts` — `{planId, interval}` request, server-side price
  resolution via `plan-catalog.ts`, never a client-trusted price ID.
- `apps/web/src/lib/billing/webhook-processor.ts` — price→plan resolution replaced with
  `resolvePriceToPlan` (legacy-aware); persists `paddlePriceId`/`billingInterval`.
- `apps/web/src/lib/billing/paddle-api.ts` — added `previewSubscriptionUpdate`,
  `updateSubscriptionItem` (the one real destructive plan-change call).
- `apps/web/src/lib/admin/subscriptions.ts` — `listSubscriptions` left-joins `plan_prices` for
  legacy/environment-mismatch flags; `resyncSubscription` persists price/interval, still never
  writes `users.plan_id`.
- `apps/web/src/pages/admin/plans/index.astro`, `apps/web/src/components/admin/
SubscriptionsManager.tsx` — full catalog/legacy/environment-mismatch visibility.
- `apps/web/src/pages/pricing.astro` (SSR now), `apps/web/src/pages/app/billing/index.astro`,
  `apps/web/src/pages/sign-in.astro` (checkout continuity), `apps/web/src/pages/index.astro` +
  `apps/web/src/components/homepage/PricingPreviewSection.astro` (no price figures).
- `apps/web/src/lib/analytics.ts` — 8 new `PRODUCT_EVENT_NAMES` (see event-model doc for why 2
  originally-declared names were removed rather than left unfired).
- `apps/web/src/worker.ts` — scheduled-downgrade cron job.
- `.github/workflows/{deploy-preview,deploy-production}.yml` — automatic reference-data reseed on
  every deploy (see "Deployment gap found" below).
- `docs/release/ROLLBACK_RUNBOOK.md` — stale `plan-mapping.ts`/env-var Paddle-recovery guidance
  corrected to the new DB-backed model.
- `packages/database/seed/reference-data.sql`, `apps/web/tests/integration/d1-harness.ts` — 15 and
  7 `plan_prices` rows respectively (production + sandbox-placeholder + test-scoped).

**Deleted:**

- `apps/web/src/lib/billing/plan-mapping.ts`, `apps/web/src/lib/plans.ts` (+ its guard-rail test
  asserting no monthly pricing exists), `packages/core/src/api/contracts/billing.ts` (RISK-016;
  confirmed zero references before deletion).

## Deployment gap found and fixed during this phase

Migration `0021` creates the `plan_prices` table, but a migration never contains data — the actual
prices live in `reference-data.sql`, which historically required a **manual**
`pnpm db:seed:reference-data:remote` run after any migration adding seed-dependent data. Because
`/pricing` is now SSR and throws on a missing active price row, an unseeded table doesn't fail
quietly — it 500s, and `deploy-preview.yml` auto-triggers on every `main` merge with its own
`smoke:preview` step checking `/pricing/` for 200. Left as-is, merging this phase would have broken
the very next automatic preview deploy's own smoke test, unattended. Fixed by adding the
idempotent (`INSERT OR IGNORE`, verified) reference-data seed step to both `deploy-preview.yml` and
`deploy-production.yml`, immediately after migrations, on every deploy going forward — see
`docs/billing/BILLING_DEPLOYMENT_AND_ROLLBACK_RUNBOOK.md`.

## Tests

- **Unit**: `plan-change.test.ts` (8 tests, the direction rule across all 4 required cases plus 2
  compound cases) and `BillingPlansSection.test.ts` (5 tests, the client-side label mirror).
- **Integration**: `billing-checkout-and-plan-change.integration.test.ts` (11 new tests, real D1)
  covering server-side price resolution (including a client attempting to smuggle a price ID/
  amount through extra request fields — silently ignored), free-plan/invalid-interval/
  unauthenticated/cross-origin rejection, immediate-upgrade preview+confirm using mocked-but-real
  Paddle response shapes (never crediting the entitlement locally), scheduled-downgrade confirm
  (asserting Paddle is never called), same-plan and no-subscription rejection, and cancel-scheduled.
  2 new tests added to `billing-webhook.integration.test.ts` (legacy-price resolution, unresolvable
  -price honesty — 14/14 passing including the pre-existing race test, RISK-012 not touched
  further). Existing 3 broken-by-migration tests fixed (hardcoded fixture price IDs updated to the
  new DB-backed seed).
- **E2E**: `checkout-continuity.spec.ts` — a real browser, real WebAuthn journey: anonymous visitor
  picks Pro/yearly on `/pricing`, signs up via the real passkey ceremony, lands on `/app/billing?
plan=pro&interval=year` with the yearly toggle correctly preselected. A genuine Paddle-overlay
  checkout-completion e2e test was not built — no real sandbox Paddle catalog exists (sandbox
  `plan_prices` rows are placeholder IDs only; see the reconciliation runbook), so such a test could
  not honestly complete.
- **Accessibility**: new `/app/billing` check added to `home.spec.ts`'s authenticated-routes
  describe block (real axe-core scan, zero violations); `/pricing` (pre-existing) re-verified clean
  against the redesigned page.
- **Responsive**: new `/app/billing` check added to `responsive-smoke.spec.ts`'s authenticated-
  shells describe block at all 5 required breakpoints (360/768/1280/1440/1920px, no horizontal
  overflow); `/pricing` (pre-existing) re-verified clean.

**Not written**, and explicitly not claimed as covered: the full A–I named e2e journey set from
this phase's own prompt (new-subscriber Solo/Pro/Agency purchases specifically, legacy-subscriber
journey, mobile-viewport plan-change) — blocked on the same real-sandbox-catalog gap noted above,
not attempted with a fabricated substitute. `pnpm paddle:catalog:sync` (a write-capable
reconciliation command) was deliberately not built — only the read-only `verify` exists; see
`docs/billing/PADDLE_CATALOG_RECONCILIATION_RUNBOOK.md`'s explicit scope boundary.

## Validation

- `pnpm run quality` (format, lint, typecheck, unit — 315 tests, integration — 173 tests,
  `db:validate` — 42 tables consistent, production build): **all green**.
- `pnpm run verify:push` (full local CI reproduction: migrate, seed, format/lint/typecheck/unit/
  integration/db:validate/build, then a real Chromium e2e suite — 88/88 passed — and a11y suite —
  87/87 passed — against a live dev server, then a secret scan — clean): **all green**, one run.
- `pnpm paddle:catalog:verify production` was not run against real production credentials from
  this session (no `CLOUDFLARE_API_TOKEN`/`PADDLE_API_KEY` available here) — its argument parsing,
  Cloudflare/Paddle REST call shapes, and error-handling paths were exercised locally (confirmed
  correct usage/error output with no credentials present); a real run against production is a
  deployment-adjacent follow-up, not a blocker for this report.

## Deployment

Merged to `main` as `16d586419d09c2df39dc1411d079a21a18af0dd2` (PR #80, squash-merge; CI green on
both the PR and the resulting `main` push — including the Chromium E2E + accessibility smoke job,
88/88 and 87/87 respectively). Deployed to production 2026-08-04 via `deploy-production.yml`, with
explicit user authorization requested and given separately from the merge, per CLAUDE.md's
non-negotiable rule (the live Paddle **catalog** write, 6 new prices, already had its own separate
explicit confirmation earlier in this phase). Migration `0021_plan_prices.sql` applied to
production D1, followed by the newly-automated reference-data seed step (see "Deployment gap found
and fixed" above) — the in-workflow smoke test passed.

Independently re-verified directly against the live site afterward:

- `/pricing` (200) renders all 7 real approved offers with correct prices: Free $0; Solo $9/mo,
  $89/yr; Pro $19/mo, $189/yr; Agency $39/mo, $389/yr — "Most Popular" badge on Pro. No Paddle
  price ID appears anywhere in the page's HTML (only exposed through the authenticated checkout
  API response, never baked into public markup).
- The page's structured pricing data (`WebApplication`/`Offer` JSON-LD) contains exactly 7 `Offer`
  entries, at those same 7 real prices — confirming both intervals are listed regardless of the
  client-side toggle default.
- `/app/billing` and `/admin/plans` both correctly return `302` to `/sign-in` for an unauthenticated
  request.
- `POST /api/billing/checkout` correctly rejects a cross-origin request with `403 FORBIDDEN`
  (`"Cross-site request blocked."`) — live confirmation of the CSRF defense-in-depth described in
  the threat review.
- `GET /api/billing/webhook` correctly returns `404` (the route only defines `POST`).

Deployed Worker version ID: `7ed25286-f394-4517-aca6-5fe5168b41a4`. Build artifact checksum:
`c3f65964f0aae4196ef6b806a288fd307c6baef8dc6e24eb499493785c23f293`. See `CHANGELOG.md`'s
"Production deployment (2026-08-04) — Phase 6" entry.

**Not part of this deployment's verification, consistent with the rest of this report**: no real
Paddle checkout, plan-change, or webhook event was triggered against production as part of this
verification pass — the checks above confirm the new code is live and behaving correctly for
unauthenticated/cross-origin/read-only requests, not a real paid transaction. `pnpm paddle:catalog:verify
production` was not run from this session (no production credentials available here); running it
is a reasonable, low-risk follow-up to independently confirm the live Paddle catalog still matches
`plan_prices` post-deploy.

## Next phase

Phase 7 depends on Phases 5-6 (satisfied) and inherits: RISK-001 (real paid checkout), RISK-012
(flaky webhook race test), RISK-028 (SRS §2.3 tagline reconciliation), the `package.json`
description-field gap, a write-capable `paddle:catalog:sync` command, and real sandbox Paddle
prices for genuine end-to-end sandbox checkout testing — see
`docs/governance/GITHUB_GOVERNANCE_SETUP_MANIFEST.md`'s Phase 6 update for the full routed list.
