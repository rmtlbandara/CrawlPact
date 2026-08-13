# Real Paid Checkout Validation Protocol

Status: current-authoritative.

## Two distinct kinds of evidence (§9, §59)

**Customer-initiated pilot purchase** (preferred): a genuinely independent pilot participant
voluntarily completes Paddle checkout at the current public price, of their own choice, with
their own money. This is the strongest possible commercial evidence (§58's "Strongest" tier).

**Owner-authorised technical purchase** (fallback, for closing the _technical_ RISK-001 only):
a real, small, explicitly authorised live transaction the owner personally funds, solely to prove
the checkout → payment → webhook → account → subscription → entitlement chain actually works.
This must never be counted as commercial demand (§9, §19).

## What the coding agent must never do (§60)

- Enter card information.
- Fabricate a payment method.
- Charge an account without fresh, explicit, in-the-moment approval.
- Create an unauthorised subscription.
- Refund or cancel a real subscription without separate explicit instruction.

## Approval gate before any owner-funded transaction (§61)

Before any such transaction, stop and state: the exact plan, the exact billing interval, the
exact real amount, whether tax may apply, what will happen, how the result will be verified, and
whether a cancellation/refund is planned. General Phase 17 approval never implies consent to a
real charge (§61) — this requires its own fresh confirmation, exactly like a production deploy.

## Verification steps once a real transaction exists (§62-63, §204)

Using read-only tooling only:

1. Confirm the Paddle subscription (`subscriptions.get`) shows `status`, `collection_mode`, and
   `first_billed_at`/`started_at` consistent with a real completed payment.
2. Confirm a webhook event is linked in D1 (`subscriptions.last_paddle_event_id IS NOT NULL`).
3. Confirm the linked `billing_customers.user_id` resolves to the correct CrawlPact account.
4. Confirm the granted plan and entitlement limits match the purchased price/plan.
5. Confirm no duplicate subscription state exists for the same customer/plan.

Never expose card numbers, billing addresses, or other private payment details in any
repository-tracked document — safe internal identifiers only (§149, §205).

## Existing evidence found this phase (technical RISK-001 evidence)

During Phase 17 preflight (2026-08-11), two pre-existing, real (non-sandbox), active Paddle
subscriptions were found in production, both linked to the **product owner's own Super Admin
account** (confirmed via `admin_role_assignments`):

| Subscription     | Plan   | Status | `first_billed_at`      | Webhook linked |
| ---------------- | ------ | ------ | ---------------------- | -------------- |
| `sub_01kykw7...` | Solo   | active | 2026-07-28 (populated) | yes            |
| `sub_01kz82s...` | Agency | active | 2026-08-05 (populated) | yes            |

Both were independently re-verified read-only against the live Paddle API
(`client.subscriptions.get`) in this session: `status: "active"`, `collection_mode: "automatic"`,
`first_billed_at` populated (proving a real charge attempt succeeded), correct `price_id` per
plan. Combined with the D1-side webhook-event linkage and correct plan grant, this satisfies the
**technical** RISK-001 acceptance criteria (real checkout → real payment → real webhook →
correct user linkage → subscription created → plan granted → entitlement correct).

**This does not close RISK-001's commercial-validation purpose** — it is the owner's own account,
explicitly excluded from every paid-conversion/willingness-to-pay/revenue metric per §9/§24. See
`docs/risks/ACTIVE_RISKS.md` for the resulting risk-register update, which marks the _technical_
sub-question resolved while keeping genuine commercial validation open pending a real external
customer purchase.

No cancellation, refund, or modification was made to either subscription — per §64, a naturally
occurring (not owner-test) subscription is only observed, and per §60/§61, cancellation/refund of
a real subscription requires its own separate explicit authorisation, which was not sought or
given this session.
