# Notification Type and Producer Matrix

Every declared `notifications.type` value, its real producer (or explicit "reserved" status), and
what Phase 10 changed. Types without a producer are marked `reserved` — no producer was invented
merely to complete this table, per Phase 10's own instruction.

## Implemented

### `critical_policy_change`

- **Purpose**: a website-policy or mixed change introduced a critical-severity finding.
- **Producer**: `apps/web/src/lib/monitoring.ts`'s `safeNotifyPolicyChange`, via
  `buildPolicyChangeNotificationIntent` (`notification-intents.ts`).
- **Trigger**: a `domain_change_events` row with `eventType` in
  `{website_policy_change, mixed_change}`, `attentionLevel = high_attention`, and a finding-lifecycle
  entry with `state = appeared, severity = critical`.
- **Source-of-truth**: `domain_change_events` (Phase 8 attribution — authoritative, not
  independently recomputed).
- **Priority**: critical. **Category**: `policy_changes`.
- **Dedupe key**: `critical_policy_change:domain_change_event:{eventId}`.
- **Atom**: yes. **Retention**: none decided yet (see §Retention below).
- **Deep link**: `/app/domains/:domainId`.
- **Phase 10 change**: reordered after monitoring-state commit; failure-isolated; dedupe key added;
  no longer independently recomputes website-vs-registry drift (uses Phase 8 attribution directly).

### `high_severity_policy_change`

Same producer/trigger as above, for a `high`- (not `critical`-) severity appeared finding, or for
`attentionLevel = high_attention` reached via 3+ affected crawler purposes with no critical/high
finding. Priority: high.

### `registry_drift`

- **Purpose**: a verified crawler-registry update changed policy evaluation with the website's own
  signals unchanged.
- **Trigger**: `eventType = registry_driven_change`, `attentionLevel = high_attention`.
- **Category**: `crawler_registry`. Everything else as above.
- **Phase 10 change**: previously fired on _any_ registry-version difference regardless of
  materiality; now requires Phase 8's own `high_attention` threshold, and a mixed change can no
  longer be mislabelled into this type (see `NOTIFICATION_RELIABILITY_ARCHITECTURE.md`).

### `resource_failure`

- **Purpose**: the domain has had 2+ consecutive target-side scan failures, below the pause
  threshold.
- **Producer**: `monitoring.ts`'s `safeNotifyTargetFailure`, via `upsertGroupedNotification`.
- **Trigger**: a target-side `handleScanFailure` call with `newFailureCount >= 2`.
- **Source-of-truth**: `domains.failure_episode_id` + `consecutive_failure_count`.
- **Dedupe/grouping key**: `resource_failure:{failureEpisodeId}` — one row per failure episode,
  `occurrence_count` updated in place (Phase 10 change — previously one row per failure, collapsed
  only at presentation time).
- **Priority**: normal. **Category**: `monitoring_health`.
- **Phase 10 change**: platform-side failures never produce this type (§Failure classification).

### `monitoring_paused`

- **Purpose**: the domain reached the consecutive-failure pause threshold.
- **Trigger**: target-side failure with `newFailureCount >= failureThreshold`.
- **Dedupe key**: `monitoring_paused:{failureEpisodeId}` — exactly one per episode.
- **Priority**: high. **Category**: `monitoring_health`.
- **Phase 10 change**: never fires for a platform-side failure (real bug fixed — previously any
  failure, including CrawlPact's own internal errors, counted toward this threshold).

## Reserved (no producer — deliberately not implemented in Phase 10)

### `new_crawler`

No producer exists. See `PHASE_10_NEW_CRAWLER_NOTIFICATION_DECISION.md` — remains reserved.

### `crawler_purpose_change`

No producer exists. Same reasoning as `new_crawler`: would require new domain-impact detection
logic beyond what Phase 8's attribution model currently computes, and risks duplicating Phase 15's
registry-governance scope. Reserved.

### `subscription_issue`

No producer exists. A real, well-defined trigger point does exist
(`apps/web/src/lib/billing/webhook-processor.ts`'s `applyPlanFromStatus`, `past_due` branch), but
Phase 10 deliberately does not add a `createNotification` call there — see
`apps/web/src/pages/api/billing/AGENTS.md`'s heavy caution around this exact code path and this
repo's standing note that a real paid-checkout lifecycle has never been exercised. Reserved,
pending a dedicated billing-notifications pass with its own testing budget.

### `shared_report_expiry`

No producer exists, and none of the required infrastructure exists either — `shared_reports.expires_at`
is only checked lazily on read (`lib/sharing.ts`), there is no proactive expiry sweep. Building one
is new production surface, not reliability hardening of an existing producer. Reserved.

### `platform_notice`

No producer exists. `system_notices` (the admin-authored broadcast table) is not read anywhere
outside its own admin CRUD surface today — not even displayed publicly — so building a
notice-to-notification fan-out would be distributing a feature that doesn't have a public read path
yet. Reserved.

## Retention

No notification retention period has been approved (Phase 11's `PHASE_11_RETENTION_DECISION_MATRIX.md`
records a 90-day _recommendation_, not a decision, RISK-006, still open). Phase 10 does not invent
one — see `docs/product/PHASE_10_NOTIFICATION_RECONCILIATION_BACKFILL_POLICY.md`.
