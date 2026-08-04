# Paddle live catalog map (Phase 6)

The final, verified state of the live Paddle catalog after this phase's six price creations.
Written from a direct readback of each created price immediately after creation — not from
memory of the create calls. No secrets recorded (public Paddle product/price IDs only).

## New prices created this phase (all `status: active`, no trial, quantity 1–1, USD)

| Plan   | Interval | Amount  | Price ID                         | Product          | Product ID                       | New-checkout available |
| ------ | -------- | ------- | -------------------------------- | ---------------- | -------------------------------- | ---------------------- |
| Solo   | month    | $9.00   | `pri_01kz5ttr3ke4kz63y6yx6bh5tk` | CrawlPact Solo   | `pro_01kyfjzj2pte9mcgyg4f3smpem` | Yes                    |
| Solo   | year     | $89.00  | `pri_01kz5ttr64b2m9p930t2n660dj` | CrawlPact Solo   | `pro_01kyfjzj2pte9mcgyg4f3smpem` | Yes                    |
| Pro    | month    | $19.00  | `pri_01kz5ttr946mfx6qr6gq3n7k2b` | CrawlPact Pro    | `pro_01kyfjzj6xdb6he6mygawd165n` | Yes                    |
| Pro    | year     | $189.00 | `pri_01kz5ttrbf0v9t3yntw2azbgzz` | CrawlPact Pro    | `pro_01kyfjzj6xdb6he6mygawd165n` | Yes                    |
| Agency | month    | $39.00  | `pri_01kz5ttrdwg6gbzj0054ffnshy` | CrawlPact Agency | `pro_01kyfjzjb29p9y2ebtbxzx6nkv` | Yes                    |
| Agency | year     | $389.00 | `pri_01kz5ttrgbgjhn91qn146n23kn` | CrawlPact Agency | `pro_01kyfjzjb29p9y2ebtbxzx6nkv` | Yes                    |

Verification performed: `client.prices.list({ id: [...six ids], include: ["product"] })`
immediately after creation confirmed, for every one of the six: correct product association,
`currency_code: "USD"`, exact expected `unit_price.amount`, exact expected
`billing_cycle.interval` (with `frequency: 1`), `trial_period: null`, `quantity: {minimum:1,
maximum:1}`, `status: "active"`, and the intended `custom_data` (`application: "crawlpact"`,
`plan_code`, `billing_period`, `phase: "phase_06"`).

## Legacy prices (pre-existing, untouched, still active — never used for new checkout after this phase)

| Plan   | Interval | Amount  | Price ID                         | Status | New-checkout available |
| ------ | -------- | ------- | -------------------------------- | ------ | ---------------------- |
| Solo   | year     | $79.00  | `pri_01kyfjzj3t4x2t4dqrmnkjj0r2` | active | **No — legacy**        |
| Pro    | year     | $179.00 | `pri_01kyfjzj81k6w2ds6r6a2jcv93` | active | **No — legacy**        |
| Agency | year     | $399.00 | `pri_01kyfjzjc4tbhve9czw1dq2b1b` | active | **No — legacy**        |

Left active and unarchived deliberately (see
`docs/billing/LEGACY_PRICE_AND_SUBSCRIBER_POLICY.md`) — the one real active subscriber (Solo,
already `cancel_at_period_end=true`) is on `pri_01kyfjzj3t4x2t4dqrmnkjj0r2` and continues to
resolve/process webhooks normally. Application code (the new `plan_prices` table, seeded in
migration `0021_plan_prices.sql`) marks these `legacy=true, active_for_new_checkout=false` so
the checkout-price-resolution path never offers them to a new purchase, while the webhook
price→plan mapping still resolves them correctly for the existing subscriber.

## Archived prices (pre-existing, from an earlier catalog iteration, untouched)

| Plan   | Price ID                         | Status   |
| ------ | -------------------------------- | -------- |
| Solo   | `pri_01kyd001vg1ffsx9yg5frnvda2` | archived |
| Pro    | `pri_01kyd002z1xjv4jxa92zj1a64y` | archived |
| Agency | `pri_01kyd003jtw9tx21kjfmzsah42` | archived |

No action taken on these — not referenced by any current subscriber, not referenced by any
Phase 6 application code.

## Unchanged (verified, no write needed)

- Notification destination `ntfset_01kyfkc59d8h66prnhw220hnzy` → `https://crawlpact.com/api/billing/webhook`, active, already subscribed to every event type this phase's webhook handler needs.
- Checkout domain `chedom_01kyfnvdzbbvxx40vr7b3hvz98` → `crawlpact.com`, `approved`.

## Verification timestamp

Prices created and read back in the same session, 2026-08-04, immediately before this document
was written.
