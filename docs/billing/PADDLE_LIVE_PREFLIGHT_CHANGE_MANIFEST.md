# Paddle live preflight change manifest (Phase 6)

Produced before any Paddle production write, per the Phase 6 execution prompt's §8.3. Every
target below is unambiguous, cross-checked against a live, read-only Paddle MCP inspection
performed immediately before this document was written (see
`docs/billing/PHASE_06_EXISTING_BILLING_BASELINE.md` for the full read-only inventory and
environment-identity verification). **No write in this manifest has been executed yet** — this
is the plan submitted for explicit human confirmation before any of it runs.

## Environment confirmation (§8.1, completed)

1. MCP connected to the intended Paddle account — confirmed (client token, price IDs, and
   webhook destination all match production `wrangler.jsonc` exactly).
2. Environment is production/live — confirmed (`live_` prefixed client tokens throughout; no
   sandbox indicator anywhere in the read).
3. Account/business identifier — not separately exposed by any read-only method used; identity
   is instead established transitively via the three independent matches in the baseline doc,
   which is stronger evidence than a bare account ID would be on its own.
4. Target is not sandbox — confirmed.
5. Currency is USD — confirmed (all six existing prices are USD; no other currency in use).
6. Product belongs to CrawlPact — confirmed (`custom_data.application: "crawlpact"` on the
   archived products; active products named exactly "CrawlPact Solo/Pro/Agency").
7. No similarly-named product from another application is targeted — confirmed (only six
   products exist in this account total, all CrawlPact's own, three active three archived).
8. Every write below is idempotent — see per-item idempotency logic.

## What already exists and needs no write

- **Products**: reuse the three existing active products unchanged —
  `pro_01kyfjzj2pte9mcgyg4f3smpem` (Solo), `pro_01kyfjzj6xdb6he6mygawd165n` (Pro),
  `pro_01kyfjzjb29p9y2ebtbxzx6nkv` (Agency). No product create/update needed.
- **Notification destination**: `ntfset_01kyfkc59d8h66prnhw220hnzy`
  (`https://crawlpact.com/api/billing/webhook`) is already active and already subscribed to
  every event type this phase's webhook handler needs (`subscription.*`, `transaction.*`,
  `adjustment.*`, `customer.*` — the full 24-event set already matches what
  `webhook-processor.ts` routes on). **No notification-setting write needed.**
- **Checkout domain**: `crawlpact.com` is already `approved`. **No checkout-domain write
  needed.**

This substantially narrows the blast radius versus the general procedure the execution prompt
describes: the only live write this phase actually requires is creating six new prices on the
three already-existing products.

## Proposed writes

| #   | Action       | Target                                            | Amount              | Interval | Idempotency check before creating                                                                                                                                                                                                                                                                          |
| --- | ------------ | ------------------------------------------------- | ------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Create price | Solo product (`pro_01kyfjzj2pte9mcgyg4f3smpem`)   | $9.00 USD (900)     | month    | Search Solo product's prices for any active/archived price with `unit_price.amount=900`, `currency_code=USD`, `billing_cycle.interval=month` — none exists today (verified in the baseline read), so this will create. If a matching price is found when this actually runs, reuse it instead of creating. |
| 2   | Create price | Solo product                                      | $89.00 USD (8900)   | year     | Same check for `amount=8900, interval=year` on the Solo product. The existing Solo yearly price is `7900` (a different amount — the old $79 legacy price), so this is genuinely a new price, not a duplicate of it.                                                                                        |
| 3   | Create price | Pro product (`pro_01kyfjzj6xdb6he6mygawd165n`)    | $19.00 USD (1900)   | month    | Search Pro product's prices for `amount=1900, interval=month` — none exists.                                                                                                                                                                                                                               |
| 4   | Create price | Pro product                                       | $189.00 USD (18900) | year     | Search for `amount=18900, interval=year` — existing Pro yearly is `17900` (old $179 legacy), different amount, genuinely new.                                                                                                                                                                              |
| 5   | Create price | Agency product (`pro_01kyfjzjb29p9y2ebtbxzx6nkv`) | $39.00 USD (3900)   | month    | Search for `amount=3900, interval=month` — none exists.                                                                                                                                                                                                                                                    |
| 6   | Create price | Agency product                                    | $389.00 USD (38900) | year     | Search for `amount=38900, interval=year` — existing Agency yearly is `39900` (old $399 legacy, **note: this is a decrease**, not the same amount), genuinely new.                                                                                                                                          |

Every new price: `tax_category` inherited from its product (already `saas` on all three — reused,
not guessed, per §"Tax category" — no inconsistency found across the three products, so no stop
condition triggered here); `trial_period: null`; `quantity: { minimum: 1, maximum: 1 }` (this is
account-plan billing, not seat-based — the existing prices use `1-100`, which Phase 6 does not
need to change since quantity is enforced server-side at checkout-request time regardless, but
new prices will be created with `1-1` to remove any ambiguity at the Paddle layer too).

## What stays untouched (explicit, not an oversight)

- The three existing legacy annual prices (`pri_01kyfjzj3t4x2t4dqrmnkjj0r2` Solo $79,
  `pri_01kyfjzj81k6w2ds6r6a2jcv93` Pro $179, `pri_01kyfjzjc4tbhve9czw1dq2b1b` Agency $399) are
  **not archived, not modified, not deleted** by this phase. They remain fully active in Paddle
  so the one real existing subscriber's subscription (Solo, already `cancel_at_period_end=true`)
  continues to resolve and process webhooks correctly without any change. They become "legacy"
  only at the application level (new `plan_prices.legacy=true`,
  `plan_prices.active_for_new_checkout=false`), matching the execution prompt's explicit "Step
  10 — Do not archive legacy prices yet."
- The three archived products/prices from the earlier iteration are left exactly as archived —
  no action.
- No live payment, refund, cancellation, or subscriber modification of any kind.

## Expected final state after these six writes

Six new active, USD, no-trial, `quantity 1-1` prices exist, two per existing product (one
monthly, one yearly), at the exact approved amounts. Total live catalog becomes: 3 active
products × (2 legacy-but-still-active annual prices are unaffected + 2 new prices each) = 6 new

- 3 existing active + 3 archived = 12 prices total across 6 products (3 active, 3 archived).

## Rollback / containment

If a created price needs to be undone before it's ever exposed to real checkout (this phase's
application code will not reference any of these new price IDs until they're written into the
new `plan_prices` table in a reviewed, merged migration — so there is a safe window where a
mis-created price has zero customer-facing effect): archive the specific mis-created price via
`client.prices.update({ price_id, status: "archived" })`. Never delete (Paddle prices cannot be
deleted via the API in any case — only archived). Do not touch the three pre-existing legacy
prices or the three archived-iteration prices in any rollback scenario.

## Stop conditions (none currently triggered, listed for completeness)

- Environment identity cannot be verified → not triggered, verified above.
- Currency mismatch → not triggered, USD confirmed throughout.
- Tax-category inconsistency across the three products → not triggered, all three are `saas`.
- A matching price already exists at write time (race with a manual dashboard change since this
  manifest was written) → reuse it, do not create a duplicate; re-verify the reused price's
  `trial_period`/`status`/`quantity` match what's expected before recording it as the resolved
  ID.

## Authorization

**Not yet executed.** Per CLAUDE.md's non-negotiable production-authorization rule and this
manifest's own purpose, these six writes require the user's explicit, in-the-moment confirmation
before any of them run, requested separately from — and before — this phase's eventual
production deployment (which is its own, later, separate confirmation).
