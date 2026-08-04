# Checkout continuity architecture

How a visitor's plan/interval choice on the public `/pricing` page survives an unauthenticated
visitor's sign-up/sign-in round trip and lands them back at the right place to actually check out
— without ever trusting the browser for anything price-related along the way.

## The problem

A visitor picks "Pro, yearly" on `/pricing`, but has no account yet. They must sign up (passkey
registration) before any checkout can happen (checkout requires `requireSession()`). Without
carrying the choice through, they'd land on a blank `/app/billing` after signing up and have to
re-select the same plan/interval a second time — the exact kind of friction SRS's checkout-UX
requirements ask to avoid.

## What's carried, and how

Only a **semantic** `(planId, interval)` pair travels through the flow — never a price ID, never
an amount, never anything Paddle-specific:

```
/pricing?...           (no continuity needed here — this is the origin)
  → CTA click: href="/sign-in?plan=pro&interval=year"   (unauthenticated visitor)
  → href="/app/billing?plan=pro&interval=year"          (already-authenticated visitor, direct)

/sign-in?plan=pro&interval=year
  → validates plan/interval against closed enum allowlists
  → builds redirectTo = "/app/billing?plan=pro&interval=year" (via isSafeRelativeRedirect)
  → passkey sign-up/sign-in completes
  → browser navigates to redirectTo

/app/billing?plan=pro&interval=year
  → reads `interval` as `initialInterval` (UI toggle default only)
  → BillingPlansSection client:load renders with that toggle pre-selected
  → the customer still explicitly clicks a plan card's CTA to actually check out
```

## Why this is safe

`docs/security/PHASE_06_BILLING_AND_CHECKOUT_THREAT_REVIEW.md` §15 covers this in full; summary:

- `plan`/`interval` on `/sign-in` are validated against `PAID_PLAN_IDS`/`BILLING_INTERVALS` `Set`
  allowlists before being used for anything — an unrecognised value is silently discarded, never
  interpolated into a URL.
- The resulting `redirectTo` is still passed through the pre-existing (Phase 5)
  `isSafeRelativeRedirect()` before being trusted — defence in depth, not a new trust boundary.
- `/app/billing`'s `initialInterval` is **UI-hint only** — it sets which toggle position renders
  first, nothing more. It has no effect on what price is actually resolvable: every checkout and
  plan-change action re-validates and re-resolves the real Paddle price server-side
  (`resolveCheckoutPrice`/`resolveCheckoutPrice` via `plan-change.ts`) regardless of how the
  visitor arrived at the page or what query parameters are present.
- No mutation ever happens automatically on page load anywhere in this chain — the customer must
  still take an explicit CTA/button click at `/app/billing` to start a real checkout or plan
  change, exactly like the Phase 5 continuation-handoff flow's "one explicit click" rule.

## What deliberately isn't carried

No price ID, no Paddle product ID, no amount, no currency, and no indication of _why_ the visitor
chose that plan (no UTM-style attribution data). If `/pricing`'s catalog changes between the
visitor's click and their eventual checkout (a price is repriced, archived, etc.), the checkout
step re-resolves fresh from `plan_prices` at that moment — the continuity mechanism only ever
carries a plan/interval _intent_, never a snapshot of pricing.

## Precedent

This reuses the exact `isSafeRelativeRedirect()` mechanism and "read-only display hint, mutation
always re-validated server-side" pattern Phase 5 established for the anonymous audit-conversion
continuation flow (`docs/security/PHASE_05_AUDIT_CONVERSION_THREAT_REVIEW.md`) — `/sign-in` now
has two independent continuity mechanisms (audit continuation, checkout plan/interval) that share
the same validation primitive but never interact with each other; a continuation, when present,
always takes priority (see `sign-in.astro`'s `else if (requestedPlan)` branch).
