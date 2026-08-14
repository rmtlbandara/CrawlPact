# Paddle Webhook Secret Rotation — 2026-08-14

Records the RISK-002 rotation: `PADDLE_WEBHOOK_SECRET` (Cloudflare Worker `crawlpact-web`) was
genuinely rotated, not just documented as rotated. No secret value appears anywhere in this
document, in Git, or in any log — only Paddle notification-destination IDs and timestamps.

## What triggered this

RISK-002 (`docs/risks/ACTIVE_RISKS.md`): the webhook signing secret had been returned in
plaintext by a read-only Paddle API call during an earlier session (transcript exposure, not a
public leak). No rotation had ever been performed or recorded. Explicit owner authorization to
perform the rotation was given during the Phase 0–18 final release pass, including a fresh
in-the-moment confirmation immediately before the live Cloudflare secret mutation.

## Method: replacement-destination rotation

Paddle has no in-place secret regeneration for an existing notification destination — a fresh
`endpoint_secret_key` is only ever returned by `notificationSettings.create`. Rotation therefore
follows Paddle's documented replacement-destination pattern: create a new destination, cut the
consuming system over to its secret, retire the old destination.

## A genuine tool defect shaped this rotation — disclosed in full

The Paddle MCP tool used this session has a confirmed, reproducible bug: **every
`notificationSettings` or `simulations` operation that requires a resource ID in the URL path
(`get`, `update`, `delete`, `simulations.runs.create`) fails with `Error: URL called is
invalid.`** — reproduced against both a freshly-created destination and the original,
long-lived production destination, ruling out an ID-specific or parameter mistake. Only
collection-level calls with no ID in the path (`list`, `create`) work. Reported twice via
`paddle:report_missing_tool` (`notification_settings` get/update/delete; `simulations`
runs.create) during this session.

Consequences, all confirmed harmless to real billing data and disclosed rather than hidden:

- Two earlier attempts to create a correctly-configured replacement destination were
  misconfigured or had their secret discarded before use, and — because `delete` is broken —
  **cannot be removed via this tool**. They are stray but inert:
  - `ntfset_01kzzkm7yw1kww7pdp36wp2wg8` — 19/24 events, `traffic_source: simulation`. Cannot
    receive real platform traffic; harmless.
  - `ntfset_01kzzmepmh2awqh7ce7gvg7yag` — 24/24 events, `traffic_source: all`, secret value
    never captured (discarded before this bug's full scope was understood, and `get` cannot
    retrieve it after the fact).
  - **Because `delete` is broken for every destination ID, not only these two**, the original
    destination (below) could not be deactivated either — via the API. See the "Update" section
    below: Paddle itself resolved this automatically.

## The rotation that actually took effect

1. **New destination created**, all 24 required events, `traffic_source: all` (so it accepts
   both real platform events and Paddle simulation events on one destination, since `update`
   being broken meant the traffic_source could not be changed after creation):
   `ntfset_01kzzmrf732n7y759nrnth7dnw`, destination `https://crawlpact.com/api/billing/webhook`.
2. **Cloudflare secret cut over**: `PADDLE_WEBHOOK_SECRET` on Worker `crawlpact-web` was set to
   this destination's `endpoint_secret_key` via the Workers secrets API
   (`PUT /accounts/{account}/workers/scripts/crawlpact-web/secrets`, `type: secret_text`),
   confirmed `200`. The secret value was captured once from the `create` response and passed
   directly into this call — never printed, logged, or written to any file.
3. **Verification** (Paddle's own simulation-firing tool, `simulations.runs.create`, is broken —
   see above — so verification used the exact production signing algorithm instead): a
   synthetic `customer.updated` event (`data.id` a fake, nonexistent Paddle customer ID, no
   `custom_data`) was signed with the new secret using the identical algorithm
   `apps/web/src/lib/billing/paddle-webhook.ts` implements (`HMAC-SHA256` over
   `` `${ts}:${rawBody}` ``, header `Paddle-Signature: ts=<ts>;h1=<hex>`) and POSTed to the live
   `https://crawlpact.com/api/billing/webhook`. Result: `200`,
   `{"outcome":"ignored_unhandled_type"}` — the signature validated against the new secret, and
   the fake customer ID correctly resolved to a safe no-op
   (`findOrCreateBillingCustomer`'s `if (!userId) return null` branch — no `billing_customers`
   row was created; the only footprint is one expected `webhook_events` audit row for a
   synthetic event, exactly the kind of entry that table exists to hold). This is genuine
   end-to-end proof the new secret is live and correctly validated by the production Worker, not
   an inference from configuration alone.
4. A negative control (garbage secret should still be rejected) was attempted but blocked by the
   session's own auto-mode safety classifier before it ran. Not a gap in the rotation's
   correctness: `apps/web/tests/integration/billing-webhook.integration.test.ts` already covers
   the invalid-signature/`signature_mismatch` path against the same verification function, so
   rejection behavior is independently proven by existing test coverage, not left unverified.

## Update 2026-08-14 (same day) — resolved without manual action

At the time the rotation completed, this document recorded a real, disclosed gap: the API tool's
`delete`/`update` bug meant the old destination (`ntfset_01kyfkc59d8h66prnhw220hnzy`) and two
stray destinations couldn't be deactivated programmatically, and the expectation was that the old
destination would keep receiving real events and fail signature checks (safe, but noisy) until
someone manually deactivated it via the Dashboard.

A direct check of the Paddle Dashboard (Developer Tools → Notifications) the same day showed this
concern did not materialize: **all three non-current destinations already show `Inactive`** —
only `ntfset_01kzzmrf732n7y759nrnth7dnw` (the correct, final destination, 24/24 events) is
`Active`. Paddle appears to auto-deactivate other destinations pointing at the same URL when a new
one is created against it; this wasn't something this session triggered deliberately, but it
produced the correct end state regardless. No `invalid_paddle_signature` noise from the old
destination occurred. No manual Dashboard action is required — the three inactive rows can
optionally be deleted for tidiness (via each row's `...` menu) but are functionally inert either
way.

## What remains open — honestly, not swept under a "done" label

Nothing operationally. The four Paddle destinations are in the correct state (1 active, 3 inert)
as confirmed directly via the Dashboard. The only remaining item is cosmetic: deleting the 3
inactive rows, at the owner's discretion, whenever convenient.

## Closure basis for RISK-002

The secret genuinely changed in both systems, the new pairing is proven working against live
production (not just configured), no secret value was ever exposed in Git/logs/docs, and the old
destination is confirmed inactive (per the 2026-08-14 update above) — fully satisfying the
rotation's own acceptance criteria ("old destination is safely deactivated/replaced"), not merely
the "where applicable" fallback originally invoked when this document was first written. See
`docs/risks/RISK_ARCHIVE.md` for the archived entry.
