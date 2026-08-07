# Phase 10 — Notification and Monitoring Baseline

Real, code-verified state of the notification and monitoring systems immediately before Phase 10,
gathered by reading the actual implementation (not assumed from the SRS). Every fact below cites a
file/line.

## Monitoring

- **Scheduler**: single daily Cron Trigger, `0 3 * * *` (`apps/web/wrangler.jsonc`), handled by
  `apps/web/src/worker.ts`'s `scheduled()` export, which also runs data retention and (when
  `BILLING_ENABLED`) scheduled downgrades from the same tick — each as an independent
  `ctx.waitUntil()` with its own `scheduled_job_runs` row.
- **Batch size**: `MAX_DOMAINS_PER_SWEEP = 20` (`monitoring.ts`), admin-tunable via
  `monitoring_scan_batch_size`. Phase 11's `MONITORING_CAPACITY_PLAN.md` found this exceeds the
  Workers Free 10ms CPU budget in theory but left it unchanged (real production peak: 4
  domains/sweep).
- **Claim lock**: no separate lock table — `claimDueDomains` reuses `domains.next_scan_at` itself,
  pushing it `CLAIM_LOCK_MINUTES` (default 15) into the future via a conditional UPDATE; a crashed
  sweep self-heals once the lock window elapses.
- **Ordering**: `ORDER BY next_scan_at ASC` — NULL (never-scanned) sorts first, then
  longest-overdue (Phase 11, RISK-008).
- **Next-scan cadence**: `computeNextScanAt` (`scan-scheduling.ts`) — Solo 30 days, Pro/Agency 7
  days, Free `null` (never scheduled). Unchanged by Phase 10.
- **Failure handling (pre-Phase-10)**: `handleScanFailure` treated every failure identically —
  no distinction between a completed-but-unreachable target and a thrown platform exception.
  `FAILURE_PAUSE_THRESHOLD = 5`; backoff `2^(n-1)` days capped at 14.
- **Real bug found**: notification creation in `handleScanSuccess` ran _before_
  `recordScheduledScanOutcome` and was not wrapped in try/catch. A thrown `createNotification`
  error propagated into `runMonitoringSweep`'s outer `catch`, which then wrote a duplicate
  `internal_failure` scan record and called `handleScanFailure` a second time — incrementing
  `consecutiveFailureCount` for a scan that had, in truth, already succeeded. This is the exact
  defect Phase 10's critical reliability invariant (§7) exists to close; see
  `docs/architecture/NOTIFICATION_RELIABILITY_ARCHITECTURE.md`.
- **Real bug found**: notification type selection used a cruder `registryChanged` check
  (`computeScanDrift`) that short-circuited before the website-side severity check — a _mixed_
  (both website and registry) change was mislabelled as purely registry-driven, contradicting the
  already-shipped Phase 8 attribution model (`domain_change_events.change_origin`), which had a
  correct `mixed` value the notification path simply never consulted.

## Notification generation

Single write path, `createNotification()` (`apps/web/src/lib/notifications.ts`), called only from
`monitoring.ts`. Of the 10 declared `notifications.type` values:

| Type                                                                                                     | Producer before Phase 10                   |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `critical_policy_change` / `high_severity_policy_change` / `registry_drift`                              | Yes — via the cruder drift check above     |
| `resource_failure` / `monitoring_paused`                                                                 | Yes — failure-count threshold logic        |
| `new_crawler`, `crawler_purpose_change`, `subscription_issue`, `shared_report_expiry`, `platform_notice` | **No producer anywhere in the repository** |

No dedupe/source-reference column existed. Grouping of repeated `resource_failure` rows was
presentation-time only (`groupRepeatedFailures`, adjacency-based over the fetched page) — broke at
pagination boundaries and offered no database-level idempotency guarantee.

## In-app centre

Route `/app/notifications` (`NotificationsManager.tsx`). Before Phase 10: no filter UI (API already
supported `type`/`domainId`/`unreadOnly`/`cursor`, unused client-side), no "load more"/pagination UI
despite `nextCursor` being returned, no `aria-live` region, no accessible per-item labelling beyond
generic "Mark read" text.

## Atom feed

`GET /feed/:token.xml`. Entitlement (`privateAtomFeedEnabled`) checked only at token-issuance time,
never re-checked on read — a downgraded account's feed kept working indefinitely. No `Cache-Control`
header at all. Feed `<title>` included the account's real display name; feed `<id>` was
`urn:crawlpact:feed:${rawUserId}` — both violate minimal-metadata practice. Token generation
(256-bit CSPRNG, hash-at-rest, single-active-token-per-user, generic 404 on any invalid/revoked
token) was already correct and preserved unchanged.

## Operational visibility (Phase 11)

`GET /api/admin/capacity` (`apps/web/src/lib/admin/capacity.ts`) already exposed
`monitoring.dueNowCount`/`oldestOverdueNextScanAt` — no failure-count, paused-domain-count, or
notification-metric fields existed before Phase 10.

## Phase 11 constraints inherited unchanged

Batch size 20 (unchanged), claim-lock 15 minutes (unchanged), Workers Free plan (unchanged, not
upgraded), single daily cron (unchanged — reconciliation added as an independent job on the same
tick, not a new trigger).
