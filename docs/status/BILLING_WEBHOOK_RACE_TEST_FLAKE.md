# `billing-webhook.integration.test.ts` Race Test Flake — Root Cause and Recommended Fix

**Status: documented, not fixed.** Deliberately not touched as part of the 2026-07-30/31 content,
trust, and SEO workstream — this is billing-critical ordering logic and gets its own dedicated
change with its own review, per explicit instruction. **The production webhook handler and its
out-of-order protection are not implicated as buggy and were not changed.**

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

The bug is in the test's assumption that `Promise.all` invocation order predicts completion order.
It does not, and under real concurrent load (this workstream repeatedly triggered the flake by
running large test batches back-to-back, increasing scheduling variance), outcome 2 occurs often
enough to be a real, reproducible flake rather than a theoretical edge case.

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
