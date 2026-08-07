# Phase 10 — Notification Channels and Monitoring Reliability: Completion Report

## Executive summary

**Starting notification architecture**: a single write path (`createNotification`) with no
dedupe/source model, called from a monitoring-sweep code path that ran _before_ the domain's
monitoring state was committed and was not failure-isolated — a thrown notification error corrupted
the just-completed scan's outcome. Notification type selection recomputed a cruder, independent
website-vs-registry drift check that could mislabel a mixed change as purely registry-driven,
ignoring the more precise attribution model Phase 8 had already built and shipped.

**Starting monitoring-reliability risk**: no distinction between a target-side failure (the site
was genuinely unreachable) and a platform-side failure (CrawlPact's own code threw) — every failure,
regardless of cause, counted toward the same consecutive-failure pause threshold.

**Final notification channels**: the same two first-party channels as before (in-app centre,
private Atom feed) — no third-party service added, per the phase's explicit constraint.

**Reliability improvements**: monitoring truth now commits before notification generation is even
attempted; notification failures are caught and logged, never propagated; every notification is
idempotent at the database level; repeated target failures collapse into one incident-level row;
platform-side failures are structurally excluded from ever pausing a customer's monitoring; a
bounded, independent reconciliation job recovers any notification that still slips through.

**Monitoring outcome isolation**: proven, not asserted — see
`monitoring-outcome-isolation.integration.test.ts`, which forces the real notification-write
functions to throw and confirms scan/monitoring state is entirely unaffected.

## Starting state

- **Commit**: `27ab7e9` (post-Phase-9 deployment record, `main`).
- **Production Worker**: `da3ee995-b18b-4b14-b169-735b2a1859b8`... — see
  `docs/status/CURRENT_STATE.md`'s pre-Phase-10 frontmatter for the exact deployed identifier at
  branch time; superseded by this phase's own deployment record.
- **Migration state**: `0029` (29/29 applied).
- **Cron configuration**: one daily trigger, `0 3 * * *`, running monitoring + retention +
  scheduled-plan-changes.
- **Notification table size**: 0 rows in production (Phase 9 baseline measurement — the feature had
  shipped but never fired in production at that point).
- **Active feed-token count**: not separately measured pre-Phase-10 (no metric existed to measure it
  with — this phase adds `notifications.activeAtomTokenCount`).
- **Monitoring backlog / paused-domain count**: not separately measured pre-Phase-10 for paused
  domains (this phase adds the metric).
- **Notification failure evidence**: none observed in production (near-zero real volume to date);
  the bug this phase fixes was found by code reading and confirmed by a targeted integration test,
  not by a production incident.
- **Prior-phase reports used**: Phase 8 (`PHASE_08_SAVED_DOMAIN_CHANGE_TIMELINE_COMPLETION_REPORT.md`
  — the attribution model this phase now actually uses for notifications), Phase 9 (agency
  workspace — group-filter reuse), Phase 11 (`MONITORING_CAPACITY_PLAN.md`,
  `PHASE_11_RETENTION_DECISION_MATRIX.md`, `PHASE_11_D1_QUERY_AND_INDEX_AUDIT.md`,
  `PHASE_11_OPERATIONAL_CAPACITY_VIEW.md`).

## Notification type audit

See `docs/product/NOTIFICATION_TYPE_AND_PRODUCER_MATRIX.md` in full. Summary: 5 types implemented
(`critical_policy_change`, `high_severity_policy_change`, `registry_drift`, `resource_failure`,
`monitoring_paused` — all pre-existing, all hardened this phase), 5 reserved (`new_crawler`,
`crawler_purpose_change`, `subscription_issue`, `shared_report_expiry`, `platform_notice` — all
pre-existing gaps, none newly introduced, none given a fabricated producer). No public claim
anywhere in the codebase implies any reserved type currently fires.

## Reliability architecture

See `docs/architecture/NOTIFICATION_RELIABILITY_ARCHITECTURE.md` in full. Authoritative source
events: `domain_change_events` (policy-change notifications) and live domain state
(`failure_episode_id`/`consecutiveFailureCount`, failure-episode notifications). Notification
creation: `createNotificationOnce` (single-fire, D1-unique-index idempotent) and
`upsertGroupedNotification` (incident-level, idempotent-by-authoritative-value). Failure isolation:
Option A (best-effort after authoritative commit). Reconciliation: bounded, independent scheduled
job. Retry: every write path is safe under repeated/concurrent calls by construction, not by luck.

## Monitoring truth isolation

Exact before/after control flow documented in the architecture doc above. Proof that a notification
failure cannot mark a successful scan as failed:
`monitoring-outcome-isolation.integration.test.ts`'s first test forces
`createNotificationOnce`/`upsertGroupedNotification` to throw via a `vi.mock` wrapper around the
real `notifications.ts` module (not a stub — the real module's other exports remain real), runs a
full `runMonitoringSweep`, and asserts: `scansCompleted: 1, scansFailed: 0`; `currentScore`
correctly updated; `consecutiveFailureCount: 0`; `monitoringState: "active"`; `nextScanAt` correctly
advanced; the underlying `scans` row `status: "completed"`; the `domain_change_events` row exists;
and the notification itself is genuinely absent until reconciliation recovers exactly one.

## Notification fatigue

See `docs/product/NOTIFICATION_FATIGUE_AND_GROUPING_POLICY.md` in full. Policy-change threshold:
Phase 8's own `high_attention` (reused, not reinvented). Registry threshold: same, domain-scoped, no
account-wide storm possible. Failure episode: begins on first target failure, ends on success or
account/domain removal. Grouping: incident-level (one row, `occurrence_count`), not
presentation-time. Recovery notification: explicitly not implemented — would require a
`notifications.type` CHECK-constraint table rebuild the phase's additive-only migration policy
avoids; documented as a deliberate deferral, not an oversight.

## Monitoring health

See `docs/product/MONITORING_HEALTH_STATE_MODEL.md` and
`docs/operations/MONITORING_STATE_RECONCILIATION.md` in full. Target vs. platform: structural
(control-flow position, not error-content inspection). Backoff/pause/resume: unchanged formula,
now correctly gated to target-only. Overdue handling: `longOverdueActiveDomainCount` as a new,
purely diagnostic metric. Reconciliation: found, on evidence, to be unnecessary for monitoring state
specifically (see that document's reasoning) — a real "not needed" finding, not a skipped
requirement.

## In-app centre

Categories: 6 stable user-facing groups (`policy_changes`, `crawler_registry`, `monitoring_health`,
`billing_and_account`, `report_sharing`, `platform_notices`), mapped from the 5 currently-implemented
types. Filters: unread, category (new UI — the API already supported type/domain/unread, only
category and group filtering were newly added both API- and UI-side). Pagination: cursor-based
"Load more," now actually wired into `NotificationsManager.tsx` (previously ignored `nextCursor`
entirely). Read state: unchanged semantics, now correctly interacts with grouped rows (marking a
grouped row read doesn't retroactively affect timeline/monitoring state — read state remains purely
interaction state). Grouping: DB-level via `occurrence_count`, surfaced as `groupCount` in the API
response. Deep links: unchanged destination pattern (`/app/domains/:id`), now server-stored as
`action_path` rather than client-derived.

## Atom feed

See `docs/product/PRIVATE_ATOM_FEED_POLICY.md` in full. Entitlement: now re-checked on every read,
not just at issuance (the one genuine security gap this phase closes). Token security: unchanged
(already correct). Downgrade: feed stops immediately via the read-time check; re-upgrade restores
the same URL (documented, intentional). Metadata: display name and raw user id both removed from
feed output. Headers: `Cache-Control`, `Referrer-Policy`, `X-Content-Type-Options` all newly added
(previously absent entirely). XML: unchanged, already-correct escaping. Bounds: unchanged 50-entry
cap. Performance: no conditional-request support added (evaluated and deliberately deferred, not
measured as necessary at current volume).

## Preferences

Not implemented — see `docs/product/PHASE_10_NOTIFICATION_PREFERENCES_DECISION.md`. No requirement
authorises it; the two existing channels' own filtering/enable-revoke levers were judged sufficient.

## Database

**Migration**: `packages/database/migrations/0030_notification_monitoring_reliability.sql` —
additive only. New `notifications` columns: `category`, `priority`, `source_type`, `source_id`,
`dedupe_key`, `action_path`, `occurrence_count`, `last_occurred_at`, `model_version`. New `domains`
column: `failure_episode_id`. No new tables. **Indexes**: `idx_notifications_user_dedupe` (unique),
`idx_notifications_source`, `idx_domain_change_events_observed_at`. **Query plans**: see
`docs/data/PHASE_10_NOTIFICATION_QUERY_AND_INDEX_AUDIT.md`. **Retention impact**: none — the open
notification-retention recommendation (RISK-006) is unaffected, not resolved, by this phase.

## Operations

**Monitoring metrics** (new, via `GET /api/admin/capacity`): `pausedDomainCount`,
`platformFailureCountLast24h`, `targetFailureCountLast24h`, `longOverdueActiveDomainCount`.
**Notification metrics** (new): `createdLast24h`, `activeAtomTokenCount`, `reconciliationLastRun`.
**Thresholds**: `docs/operations/PHASE_10_MONITORING_RELIABILITY_THRESHOLDS.md`. **Super Admin
view**: extended existing `GET /api/admin/capacity` snapshot, no new admin route or UI page (matches
that endpoint's own existing precedent of being API-only, UI deferred). **Reconciliation job**:
`runNotificationReconciliationJob`, its own daily `ctx.waitUntil()`/`scheduled_job_runs` row.

## Security

Full review: `docs/security/PHASE_10_NOTIFICATION_MONITORING_THREAT_REVIEW.md` — every listed threat
category assessed, most preserved-and-verified-unaffected, five genuinely fixed this phase
(notification-failure state corruption, duplicate-under-retry, feed-entitlement-bypass-on-downgrade,
missing Cache-Control/Referrer-Policy, platform-failure misattribution).

## Accessibility

105 (Phase 9 baseline) + 4 new Phase 10 a11y scans = 109 total, **109/109 passing, zero WCAG 2.2 AA
violations** (full local Chromium run, `playwright.a11y.config.ts`). New scans: empty notification
centre, populated list with grouping/filters, a monitoring-paused notification, the Atom
feed-management panel including the created-secret state.

## Performance

No dedicated before/after latency measurement was run this phase (no production traffic exists to
measure against — Phase 9's own baseline confirmed 0 notification rows in production). Structural
performance properties confirmed instead: notification writes add at most one extra indexed SELECT
per call (`upsertGroupedNotification`'s existing-row check); reconciliation is bounded and runs
outside the monitoring sweep's own loop, so it cannot reduce scan throughput by construction; no N+1
query was introduced (confirmed by code reading of the group-filter resolution and the reconciliation
loop, both single-query-per-batch, not per-row).

## Analytics

12 new categorical events — `docs/analytics/PHASE_10_NOTIFICATION_EVENT_MODEL.md`. No notification
body/title/domain/token/id ever sent as a property, confirmed by reading every new `trackEvent`/
`track()` call site.

## Validation

| Command                                                                             | Result                                                                                                     |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `pnpm run format:check`                                                             | pass                                                                                                       |
| `pnpm run lint`                                                                     | pass (0 warnings, `--max-warnings=0`)                                                                      |
| `pnpm run typecheck`                                                                | pass (0 errors)                                                                                            |
| `pnpm run test:unit` (`vitest --project unit`)                                      | **375/375 pass** (365 pre-existing + 10 new, `notification-intents.test.ts`)                               |
| `pnpm run test:integration` (`vitest --project integration`)                        | **253/253 pass** (240 pre-existing + 13 new across 3 new files)                                            |
| `pnpm run db:validate`                                                              | pass — 47 tables verified consistent between migrations and Drizzle schema                                 |
| Fresh + populated D1 migration application (`wrangler d1 migrations apply --local`) | pass — migration `0030` applied cleanly to the existing local dev D1 (already populated from prior phases) |
| `pnpm test:e2e:chromium` (`playwright test --project=chromium`)                     | **133/133 pass** (124 pre-existing + 9 new, `notifications-monitoring-reliability.spec.ts`)                |
| `pnpm test:a11y:chromium`                                                           | **109/109 pass**, 0 WCAG 2.2 AA violations (105 pre-existing + 4 new)                                      |
| `pnpm run build` (production build)                                                 | pass                                                                                                       |

Two pre-existing tests were intentionally updated to assert new, better-specified behaviour (not
regressions): `monitoring.integration.test.ts`'s drift-detection test (fixture now varies robots.txt
content, not just the crawler-result flag, to correctly exercise Phase 8 attribution) and its
failure/pause test (asserts one grouped `resource_failure` row with the correct `occurrenceCount`,
not multiple ungrouped rows); `notifications-flow.integration.test.ts`'s grouping test (seeds via
the real `upsertGroupedNotification` write path instead of two raw inserts, since grouping is now a
write-time, not read-time, concern).

## Production deployment

Recorded separately in `CHANGELOG.md` and `docs/status/CURRENT_STATE.md` once deployed, following
this repository's established pattern (feature PR, then a dated deployment-record entry after
independent production verification).

## Deferred work

- **External notification channels** (email, SMS, push, webhooks, Slack/Teams/Discord/WhatsApp/
  Telegram): not approved, not added — confirmed absent from every dependency, config, and code path
  touched this phase.
- **Public incident/status automation**: Phase 14's scope; `PHASE_10_MONITORING_RELIABILITY_THRESHOLDS.md`
  explicitly declines to build it.
- **Registry-publication notifications**: Phase 15's scope; see
  `PHASE_10_NEW_CRAWLER_NOTIFICATION_DECISION.md`.
- **Team-member notification preferences**: dependent on a future collaboration model that does not
  exist yet (Phase 9 confirmed no team-account model is authorised).
- **`monitoring_recovered` notification type**: deferred pending a phase that can justify the
  `notifications.type` CHECK-constraint table rebuild.
- **`subscription_issue`/`shared_report_expiry`/`platform_notice` producers**: reserved, each with
  documented reasoning in the type matrix.

## Runtime impact

Phase 10 hardens CrawlPact's scheduled monitoring reliability, monitoring-health state, failure
classification, notification generation, notification idempotency, reconciliation, in-app
notification centre, and private Atom feed. It preserves existing crawler classifications,
crawler-registry governance, audit semantics, pricing, plan limits, Paddle configuration, monitoring
frequencies, history retention, authentication model, agency workspace boundaries, and public trust
requirements. It does not introduce third-party email, SMS, push, webhook, chat, or messaging
services.

## Next phase

Phase 12's starting inputs from this phase: a verified, idempotent notification pipeline
(`createNotificationOnce`/`upsertGroupedNotification`) any future notification-producing feature
should reuse rather than duplicate; a real target/platform failure taxonomy any future
monitoring-adjacent feature should respect; the `notifications`/`domains` schema extension points
(`category`, `priority`, `source_type`/`source_id`, `failure_episode_id`) already in place for reuse
without another migration.
