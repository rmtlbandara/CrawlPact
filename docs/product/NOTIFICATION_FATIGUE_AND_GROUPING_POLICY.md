# Notification Fatigue and Grouping Policy

## What merits interruption

A notification is created only when:

- A domain-change event's `attentionLevel === "high_attention"` (Phase 8's own threshold: a
  critical/high-severity finding appeared, or 3+ crawler purposes were affected) **and** its
  `eventType` is `website_policy_change`, `registry_driven_change`, or `mixed_change`
  (`buildPolicyChangeNotificationIntent`, `notification-intents.ts`).
- A target-side scan failure is the 2nd or later in the domain's current failure episode
  (`resource_failure`), or crosses the pause threshold (`monitoring_paused`).

## What remains timeline-only (never interrupts)

- `attentionLevel === "informational"` or `"review_recommended"` — visible in the domain's change
  timeline (Phase 8), never a notification. Covers: whitespace/comment-only robots.txt edits (no
  crawler-result change → `no_change`, no event at all), low/medium-severity findings with no
  meaningful user action, baseline creation, operational events (preset changes, an incomplete-scan
  comparison), and — under the current attribution model — `uncertain`-origin events (always mapped
  to `informational` attention today; see re-evaluation note below).
- The **first** target-side scan failure in a streak — a single transient network blip is recorded
  internally (`consecutiveFailureCount` increments, `failure_episode_id` is minted) but produces no
  notification.
- Any platform-side failure (a CrawlPact-caused error) — never a user-facing notification at all;
  see `docs/security/PHASE_10_NOTIFICATION_MONITORING_THREAT_REVIEW.md`'s "platform failure
  incorrectly treated as target failure" entry.

## Repeated-failure grouping

**Incident-level notification** (not presentation-time grouping) — one `resource_failure` row per
domain failure episode, `occurrence_count` updated in place via `upsertGroupedNotification`. An
episode:

- **Begins**: the first target-side failure after a success (or ever), minting
  `domains.failure_episode_id`.
- **Continues**: through consecutive target-side failures — `occurrence_count` reflects the current
  authoritative `consecutiveFailureCount`.
- **Ends**: on the next success (`failure_episode_id` cleared to `null`,
  `recordScheduledScanOutcome`'s success branch) or the account/domain being disabled/deleted.

This design was chosen over pure presentation-time grouping because it works correctly across Atom
feed pagination and in-app cursor pagination (a DB row boundary, not a fragile "are these two rows
adjacent on this page" check) and never rewrites unrelated read history — see
`docs/architecture/NOTIFICATION_RELIABILITY_ARCHITECTURE.md`.

## Registry-change grouping

Not a separate mechanism — a registry-driven event already only notifies when the specific domain's
own evaluation crossed `high_attention`, so no account-wide "registry release" storm is possible by
construction (see `PHASE_10_NEW_CRAWLER_NOTIFICATION_DECISION.md`).

## Maximum useful frequency

No fixed rate limit is imposed; frequency is bounded structurally instead — one notification per
distinct domain-change event (deduped by event id) and one row per failure episode (deduped by
episode id), so the practical ceiling is "one notification per genuinely new, material fact," not a
count.

## Recovery notification

**Not implemented in Phase 10.** A `monitoring_recovered` notification type does not exist in the
`notifications.type` CHECK constraint; adding one would require a SQLite table rebuild (no
in-place `ALTER ... ADD CHECK` for an existing column), which this phase's migration deliberately
avoids (additive-only, per `packages/database/AGENTS.md`). The prompt's own guidance — "only
implement when it provides useful closure without creating noise" — is satisfied by _not_ adding it
given the schema cost; deferred to a future phase that can justify the table-rebuild risk.

## When a read notification may be followed by a new one

- Policy-change and `monitoring_paused` notifications are single-fire per source event — reading one
  never affects a later, genuinely distinct event's own notification.
- `resource_failure`'s grouped row: reading it does **not** get re-surfaced as unread by a retried
  write for the _same_ occurrence count (idempotent no-op), but **is** re-surfaced as unread when a
  strictly higher `occurrence_count` arrives (a real new failure happened) — verified by
  `notification-dedupe-reconciliation.integration.test.ts`.

## Uncertain-origin re-evaluation note

Phase 8's `computeAttentionLevel` always maps `uncertain`-origin events to `informational` — so they
never reach the notification threshold today. `notification-intents.ts` still correctly excludes
`uncertain`/`operational` from ever producing a notification even if that mapping changes later,
without requiring a Phase 10 code change.
