# `billing-webhook.integration.test.ts` Race Test Flake — Root Cause and Applied Fix

**Status: fixed 2026-08-04 — this document's original conclusion was wrong.** Root-caused here
2026-07-31 as "the out-of-order protection is correct, only the test's assertion is too strict."
Recurred in real CI on `main` twice more (commits `abab3d4` and `a66f4e5`, the latter a
CHANGELOG-only commit — conclusive proof the failure tracked request-timing variance, not code
content) before Option A below was actually applied, per its own explicit dedicated review.
Applying Option A's own recommended strict final-state assertion (`subs[0].status` must always be
`"active"`, not "either trialing or active") is what surfaced the real bug: repeated local runs
reproduced a genuine case where **both** deliveries reported `outcome: "processed"` yet the row was
left at `"trialing"` — a silent regression this document's original "no data corruption occurs in
this branch" claim missed. **The webhook handler's out-of-order protection was rebuilt** (see
"Applied fix" below) to close the actual window; it was not left as originally found.

## Symptom

`apps/web/tests/integration/billing-webhook.integration.test.ts`, the test
`"processes both events when two related deliveries for a brand-new subscription race
concurrently"`, intermittently fails with:

```
AssertionError: expected 'ignored_out_of_order' to be 'processed'
```

Observed 3 times across this workstream's sessions (2026-07-30 and 2026-07-31), always the same
assertion, always clean on an immediate retry — both in isolation and as part of the full suite.

## The test, as written

```ts
const [first, second] = await Promise.all([
  postWebhook(
    racePayload("evt_race_created", "subscription.created", "...T00:00:00.000000Z", "trialing"),
  ),
  postWebhook(
    racePayload("evt_race_activated", "subscription.activated", "...T00:00:00.500000Z", "active"),
  ),
]);
expect(first.status).toBe(200);
expect(second.status).toBe(200);
// ...
if (firstBody.ok) expect(firstBody.data.outcome).toBe("processed");
if (secondBody.ok) expect(secondBody.data.outcome).toBe("processed");
```

Two webhook deliveries for the same brand-new subscription (`sub_race_1`), fired via
`Promise.all`: `subscription.created` with `occurred_at = T+0.0s`, `subscription.activated` with
`occurred_at = T+0.5s`. The test asserts **both** resolve to `outcome: "processed"`.

## The handler's actual, correct logic

`apps/web/src/lib/billing/webhook-processor.ts`:

```ts
async function isOutOfOrder(db, subscriptionRowId, occurredAt): Promise<boolean> {
  const [latest] = await db
    .select({ occurredAt: schema.webhookEvents.occurredAt })
    .from(schema.webhookEvents)
    .where(and(eq(relatedSubscriptionId, subscriptionRowId), eq(status, "processed")))
    .orderBy(desc(occurredAt))
    .limit(1);
  return latest ? latest.occurredAt > occurredAt : false;
}
```

Before processing a webhook for an existing subscription row, the handler checks whether a
**already-processed** event for that subscription has a _later_ `occurred_at` than the one
currently being handled. If so, the current event is chronologically stale relative to what's
already recorded, and is correctly rejected as `ignored_out_of_order` rather than overwriting
newer state with older state.

## Root cause

`Promise.all` starts both HTTP requests concurrently — it makes no guarantee about which one's
handler function, database reads, or database writes complete first. Two outcomes are both
legitimately possible, depending on real scheduling:

1. **`created` (T+0.0s) is processed and committed first**, then `activated` (T+0.5s) is checked:
   `isOutOfOrder` finds the latest processed event at T+0.0s, which is _not_ later than T+0.5s, so
   `activated` proceeds normally. **Result: both "processed."** This is the order the test's
   assertions assume is the only possible one.
2. **`activated` (T+0.5s) is processed and committed first**, then `created` (T+0.0s) is checked:
   `isOutOfOrder` finds the latest processed event at T+0.5s, which _is_ later than T+0.0s, so
   `created` is correctly rejected. **Result: one "processed," one "ignored_out_of_order."** This
   is exactly the failure observed — and it is the out-of-order protection working as designed,
   not a defect. No data corruption occurs in this branch either: the subscription row still ends
   up reflecting the `activated` event's state, since that event carries the later timestamp and
   processed successfully.

**Correction, 2026-08-04: this analysis was incomplete.** It only considered `isOutOfOrder`
returning `true` or `false` based on a snapshot it had already read. It missed a **third**
outcome, reproduced directly (1 failure in 34 local runs, then confirmed non-reproducing after the
fix in 40/40 runs): `isOutOfOrder`'s query against `webhook_events` ran in the window _after_
`activated`'s row write to `subscriptions` had already committed but _before_ `activated`'s own
`webhook_events` row was marked `"processed"` (that happens later, in the outer
`processPaddleWebhookEvent`, after `handleSubscriptionEvent` fully returns). In that window,
`created`'s check finds nothing and proceeds to update — **both report "processed," yet `created`'s
UPDATE overwrites `activated`'s already-committed `"active"` status back to `"trialing"`.** This
is real data corruption, not merely an audit-trail/outcome-label discrepancy. See "Applied fix"
below.

The bug is in the test's assumption that `Promise.all` invocation order predicts completion order.
It does not, and under real concurrent load (this workstream repeatedly triggered the flake by
running large test batches back-to-back, increasing scheduling variance), outcome 2 (and,
undetected until now, outcome 3) occurs often enough to be a real, reproducible flake rather than a
theoretical edge case.

## Why this should not be "fixed" by loosening the out-of-order check

The out-of-order protection exists specifically to prevent a late-arriving, stale webhook delivery
from clobbering more-current state — removing or weakening it to make this test pass
unconditionally would reintroduce exactly the bug class `docs/architecture/adr/` and PR #55
("fix(billing): stop misclassifying Paddle webhook races and draft transactions as failed") were
written to prevent. The handler's behavior in outcome 2 above is correct; the test's assertion is
what's wrong.

## Recommended remediation (not applied here — needs its own change and review)

Per instruction, the eventual fix should make the test either deterministic or assert behavior
independently of `Promise.all` invocation/completion order. Two viable approaches:

**Option A — assert final-state invariants instead of per-request outcomes.** Regardless of which
request's database write lands first, both orderings above converge on the same safe final state:
exactly one `subscriptions` row for `sub_race_1`, with status reflecting the event with the latest
`occurred_at` (`active`, from `subscription.activated`), and neither webhook delivery resulting in
an unhandled `"failed"` outcome. Rewrite the assertions to check:

```ts
expect([firstBody.data?.outcome, secondBody.data?.outcome].sort())
  .toEqual(["ignored_out_of_order", "processed"].sort())
  .or(["processed", "processed"]); // pseudocode — actual assertion should accept either valid pairing
```

concretely: assert neither outcome is `"failed"`, assert at least one is `"processed"`, and assert
the **final** subscription row's status is `"active"` — the property that actually matters,
independent of which specific request "won."

**Option B — make delivery order deterministic in the test.** If the intent is specifically to
test "two deliveries arrive back-to-back in the correct temporal order," `await` them sequentially
(`created` then `activated`) rather than via `Promise.all`, and keep a _separate_, explicitly
out-of-order test (`activated` then `created`) that asserts the second is correctly rejected. This
trades testing "genuine concurrency" for testing each ordering explicitly and deterministically —
arguably clearer intent, at the cost of no longer exercising true concurrent-request handling.

**Recommendation**: Option A more faithfully tests the real production scenario (Paddle does not
guarantee delivery order under true concurrency) and should be preferred. Either way, this is a
billing-correctness test change and should go through its own dedicated review and CI run, not be
bundled into an unrelated change.

## Applied fix (2026-08-04)

Two changes, in a dedicated PR:

**1. The test** (`apps/web/tests/integration/billing-webhook.integration.test.ts`), following
Option A above: the per-request outcome assertions now accept either `"processed"` or
`"ignored_out_of_order"` for each delivery individually, plus an explicit assertion that **at
least one** of the two is `"processed"` (the race winner always is — `subscription.activated`,
carrying the later `occurred_at`, can never itself be judged out-of-order relative to the earlier
`subscription.created`, so a result where both are ignored would indicate a real regression). The
final-state assertion was written strictly, exactly as Option A recommended: the subscription
row's status must be `"active"`, never "either trialing or active" — and running this strict
assertion repeatedly is what surfaced the real bug documented above.

**2. The webhook handler itself** (`apps/web/src/lib/billing/webhook-processor.ts`) — this was
_not_ supposed to change per the original analysis, but the analysis was wrong. The `isOutOfOrder`
helper (a separate `SELECT` against `webhook_events` for "the latest already-`processed` event")
is removed entirely. In its place, a new nullable `subscriptions.last_applied_occurred_at` column
(migration `0019_subscriptions_last_applied_occurred_at.sql`) stores the `occurred_at` of the event
that most recently wrote to that specific row, and every UPDATE to the row is a compare-and-swap:

```ts
.where(and(
  eq(schema.subscriptions.id, existingSub.id),
  or(
    isNull(schema.subscriptions.lastAppliedOccurredAt),
    lt(schema.subscriptions.lastAppliedOccurredAt, event.occurredAt),
  ),
))
.returning({ id: schema.subscriptions.id });
```

If zero rows come back, some other, newer event already won — this event is genuinely stale and is
rejected as `ignored_out_of_order`. The comparison and the write happen in the same SQL statement,
evaluated by SQLite against the row's actual current committed state, not a value read earlier in
application code — closing the window entirely, rather than moving the watermark from one place
that could still race to another.

**Verification**: the isolated race test was run 40 consecutive times after the fix with zero
failures (versus 1 failure in 34 runs before it, empirically reproducing the bug), then the full
integration suite (149 tests) was run 3 consecutive times, all passing, plus `db:validate`,
`typecheck`, `lint`, `build`, and CI.
