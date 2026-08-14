# Phase 14 Notification Retention Decision

**Level 4 document.** Revisits RISK-006's `notifications` half.

## Current state

`notifications` has **no retention category** in `lib/data-retention.ts` — rows accumulate
indefinitely, including already-read ones. Phase 11's own recommendation was 90 days after read.

## Considerations

- **Unread notifications**: represent real, pending information a user hasn't seen yet — should
  never be purged purely on age while unread, regardless of what period is eventually chosen for
  read ones.
- **Read notifications**: once read, a notification's ongoing value is mostly historical
  (did-this-happen recall) rather than actionable — a 90-day-after-read window (Phase 11's
  recommendation) was reasoned as long enough to cover realistic "wait, did I already see that?"
  lookback without being unbounded.
- **Atom feed**: private per-account Atom feeds (`/feed/[token].xml`) already re-check entitlement
  on every read (Phase 10) and are unaffected by notification retention specifically — the feed's
  own content window is derived from recent `domain_change_events`, not from the full
  `notifications` table history.
- **Reconciliation**: `reconcileMissingPolicyChangeNotifications`'s own `lookbackMinutes` (default 180) is far shorter than any retention period under consideration — retention would never
  interfere with reconciliation's own bounded recovery window.
- **User expectations / timeline availability**: `docs/product/AUDIT_CONVERSION_STATE_MODEL.md`-
  adjacent product docs don't promise unlimited notification history; the domain change timeline
  itself (a separate, richer history view) is unaffected by notification retention, since it reads
  `domain_change_events` directly, not `notifications`.

## Update 2026-08-14 — implemented

The exact 90-days-after-`read_at` period this document already reasoned through was explicitly
approved by the product owner in the "Final Phase 0–18 Blocker Removal and Production Release
Prompt" §28, §30, and implemented that day: `purgeExpiredReadNotifications` in
`apps/web/src/lib/data-retention.ts`. `isNotNull(readAt)` is load-bearing in the WHERE clause — an
unread notification is never purged on age alone, exactly as required. See
`apps/web/tests/integration/data-retention.integration.test.ts`'s "RISK-006" describe block,
including an explicit "very old, never read" case that survives the purge. RISK-006's
`notifications` half is archived — `docs/risks/RISK_ARCHIVE.md`.

## Decision (historical — superseded by the update above): **RISK-006 remains open for `notifications`**

Same reasoning and same outcome as the security-events decision
(`docs/data/PHASE_14_SECURITY_EVENT_RETENTION_DECISION.md`): the Phase 14 prompt's conditional
acceptance language was not satisfied by an explicit product-owner decision in the prompt actually
provided this phase, so per its own "otherwise leave the risk open" instruction, **no retention
category was implemented for `notifications` this phase**. This document does _not_ "keep unread
rows forever merely to avoid making a decision" in the sense the prompt warns against — a real
decision was reasoned through (90 days after read, Phase 11's own recommendation, remains the
best-evaluated option) and explicitly not implemented pending the missing approval, which is a
different thing from never having decided at all.

## What would need to happen to close this

An explicit, in-the-moment product-owner decision on the retention period for read notifications
(90 days after `read_at`, the only period evaluated to date) plus explicit confirmation that unread
notifications are never purged on age alone — at which point implementation reuses the same
`lib/data-retention.ts` category pattern as every other category.
