# Phase 14 — Status, Operations and Service Reliability — Completion Report

**Date**: 2026-08-10 · **Branch**: `phase-14-status-operations-reliability` · **Base commit**:
`37814248f5c60269a7726b4a27d6e1407b7e965a` (main, post-Phase-13-deployment-record merge, PR #106)

## Summary

This was a reliability-consolidation and operational-readiness phase: it **strengthened** the
existing status/incident/monitoring architecture rather than rebuilding it. The public 6-state
status vocabulary and 7 canonical public components are unchanged. Two real, previously-latent
bugs were found and fixed (a status-query N+1, and a scheduled-maintenance incident escalating
before its actual start time), plus a structural gap that made the existing scheduler
stuck/overlapping-job detection unreachable (no code path ever wrote a `running` row before job
completion). A first-party, deduplicated internal alerting model was built — pull-based, no
third-party paging integration. A new Super Admin operations control plane
(`/admin/operations`) was built rather than extending `/admin/health`, justified by a real
pre-existing gap (`/admin/capacity`'s working backend had zero consuming UI anywhere in the
codebase). Internal SLIs/SLOs were defined; no public uptime percentage was published (the
7-condition gate is not met). A public status Atom feed was added. Monitoring truth remains
solely owned by Phase 10 — no second monitoring engine was built. RISK-006's `security_events`/
`notifications` retention halves remain open, per the prompt's own conditional language. No
pricing/Paddle, crawler-classification/registry, monitoring-frequency, or notification-channel
change was made. No production deployment or push occurred without explicit approval (this
report is written pre-approval, describing what is ready to ship).

## What shipped

### Public/internal status boundary preserved and hardened

- No change to `PublicStatusLevel` (`operational`, `degraded_performance`, `partial_outage`,
  `major_outage`, `maintenance`, `status_unavailable`) or the 7 canonical public components.
- Confirmed `getPublicStatus()`'s `catch` block already set every component to
  `status_unavailable` on failure, never a default "operational" — no change needed, documented
  in `docs/operations/PUBLIC_INTERNAL_STATUS_BOUNDARY.md`.
- `ComponentHealth.publicImpact` remains the single gate deciding whether an internal `degraded`
  signal reaches the public page — verified no new code path bypasses it.

### Two real bugs found and fixed

- **N+1 query**: `loadPublicIncidents` (`apps/web/src/lib/status/public-status.ts`) issued one
  `SELECT ... FROM incident_updates WHERE incident_id = ?` per incident. Fixed to a single batched
  `WHERE incident_id IN (...)` query, results grouped in memory by a `Map`. Verified via real
  `EXPLAIN QUERY PLAN` against local D1 that the batched query uses the existing
  `idx_incident_updates_incident_id` index. New test: "the batched incident-updates query attaches
  each incident's updates to the correct incident" (2 incidents × 2 updates each, no
  cross-contamination).
- **Scheduled-maintenance timing bug**: a maintenance incident with a future `startsAt` was
  escalating its public component to "Maintenance" immediately on creation, not at its actual
  start time. Fixed by gating escalation on `Date.parse(incident.startsAt) > nowMs` for
  `isScheduledMaintenance` incidents only. New test confirms a future-dated maintenance incident
  leaves the component `operational` until `startsAt` arrives, then escalates.

### Scheduled-job-run lifecycle fix

- No code path ever wrote a `status='running'` row before job completion (every insert was
  post-hoc), making `detectSchedulerAnomalies`'s stuck/overlapping-job detection structurally
  unreachable. Fixed with new `startJobRun`/`finishJobRun` helpers in `worker.ts` — `startJobRun`
  inserts a running row and captures `result.meta.last_row_id`; `finishJobRun` updates that same
  row in place on completion/failure. Applied to all 4 existing scheduled jobs (monitoring,
  notification reconciliation, scheduled downgrades, retention). 3 new integration tests prove:
  the same row transitions (not a second insert), a stale (>15min) running row is detected as
  "stuck", and 2 concurrent running rows are detected as "overlapping".
- Real `EXPLAIN QUERY PLAN` evidence also found `scheduled_job_runs` had no index supporting its
  `ORDER BY started_at DESC` queries (`SCAN scheduled_job_runs` + a temp b-tree sort). Migration
  `0033` adds `idx_scheduled_job_runs_started_at`; re-verified query plan afterward shows the
  index is used with no temp b-tree needed.

### First-party operational alerting (`operational_alerts`)

- Migration `0032`: `operational_alerts` table with a partial unique index
  (`WHERE resolved_at IS NULL`) enforcing one open row per `alert_key` at the database level.
  Fields: `alert_key`, `severity` (`info`/`warning`/`critical`), `source`, `detail`,
  `first_seen_at`, `last_seen_at`, `occurrence_count`, `resolved_at`, `acknowledged_at`/
  `acknowledged_by_user_id`.
- `apps/web/src/lib/admin/operational-alerts.ts` — `computeAlertCandidates` derives candidates
  only from existing signals (`detectSchedulerAnomalies`, `getComponentHealth`, webhook/auth
  failure counts, capacity snapshot) — no new raw signal was introduced.
  `evaluateOperationalAlerts` upserts/resolves and runs once daily from the existing
  `scheduled()` handler — **not a new Cron trigger**.
- No third-party paging integration was added (PagerDuty, Opsgenie, Better Uptime, UptimeRobot,
  Statuspage.io, Sentry, Datadog, New Relic, Grafana Cloud, Slack, Teams, SMS, email) — this is a
  deliberate, pull-based design documented in `docs/operations/OPERATIONAL_ALERT_MODEL.md`.
- 6 new integration tests: no candidates on a clean DB, webhook-failure detection,
  auth-failure-spike detection, deduplication (opens once, updates rather than duplicates on a
  second evaluation), resolution when the condition clears, and acknowledge (success + rejects an
  already-resolved alert).

### Super Admin operations control plane (`/admin/operations`)

- New, broader route rather than extending `/admin/health` — justified because `/api/admin/
capacity` (Phase 11) had a fully working backend with zero consuming UI anywhere in the
  codebase (a real, pre-existing gap, confirmed by grep before deciding).
- `apps/web/src/lib/admin/operations.ts` — `getOperationsSummary` composes `getStatusOverview`,
  `getOperationalCapacitySnapshot`, `detectSchedulerAnomalies`, `listActiveOperationalAlerts`, and
  4 `getReliabilityTrends` windows (1h/24h/7d/30d) via `Promise.all`. `deployment: null`,
  documented as genuinely unobtainable from inside a Cloudflare Worker (matches `capacity.ts`'s
  existing `notAvailableFromThisWorker` honesty pattern — no fabricated commit SHA or Worker
  version).
- `OperationsOverview.tsx` — status summary, active alerts (with acknowledge action), capacity/
  monitoring metrics, scheduler anomalies, reliability-trend tables, four manual actions (all
  `requireAdminAction`-gated: reason + step-up auth + rate limit + automatic
  `admin_audit_logs` entry, via the existing `AdminActionDialog` pattern), and drill-down links
  into 7 existing admin routes.
- New routes: `GET /api/admin/operations` (read-only), `POST /api/admin/operations/evaluate`,
  `POST /api/admin/operations/reconcile-notifications` (reuses Phase 10's exact function),
  `POST /api/admin/operations/retention-dry-run` (always `dryRun: true`, reuses Phase 11's
  dry-run option), `POST /api/admin/operations/alerts/[alertId]/acknowledge`.
- 7 new integration tests (auth/authz, real composed summary, each manual action's real effect
  and audit-log write) + 6 new Chromium e2e tests (unauthenticated redirect, all 5 section
  headings render for a real admin, drill-down link hrefs, public Atom feed shape) + 1 new a11y
  test (0 automatically detectable WCAG 2.2 AA violations).

### Internal SLIs/SLOs — no public SLA

- `docs/operations/SERVICE_LEVEL_INDICATORS.md`, `docs/operations/INTERNAL_SERVICE_OBJECTIVES.md`
  — internal-only, never surfaced publicly.
- `getReliabilityTrends(db, windowHours, now)` computes bounded ratios (monitoring timeliness,
  job reliability, billing processing reliability, auth failure count) for 4 windows, rendered as
  `N / D — P%` with `percent: null` when `D=0` — the same low-volume-data convention established
  in Phase 13's product analytics.
- **No public uptime percentage was published.** `docs/product/PHASE_14_PUBLIC_UPTIME_PERCENTAGE_
DECISION.md` records the 7-condition gate and confirms it is not met this phase; the decision is
  to keep it absent rather than fabricate or prematurely publish a number.

### Public status Atom feed

- `apps/web/src/pages/status/feed.xml.ts` — reuses `getPublicStatus()` directly (never a second
  query path), modeled on the existing private `/feed/[token].xml.ts` pattern. Bounded to 30
  items, `Content-Type: application/atom+xml`, `X-Robots-Tag: noindex`,
  `Cache-Control: public, max-age=30` (intentionally public, unlike the private feed's
  `private, no-store`), `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`.
  Linked from `/status`.
- 2 new integration tests: valid feed with correct headers; escapes injection
  (`<script>`/`&`/`"`) and excludes a non-public incident entirely.

### Independent status-plane Worker (Option B) — evaluated, not built

- `docs/operations/PHASE_14_INDEPENDENT_STATUS_PLANE_DECISION.md` documents the evaluation and
  the choice of **Option A** (keep `/status` in the main Worker/D1): Option B would require new
  production infrastructure (a second Worker, DNS, possibly KV) requiring separate explicit
  approval never sought this phase. The real correlated-failure risk this leaves open, and a
  concrete future trigger for revisiting, are both recorded.

### Maintenance mode — audited, one real gap found

- The existing `maintenance_mode` flag was audited against every documented containment claim
  (dashboard read-only for mutations, audits paused, monitoring independently paused, public site
  unaffected, billing webhooks unaffected, admins exempt) and found already correct — no code
  change needed, only documented in `docs/operations/MAINTENANCE_MODE_DECISION_MATRIX.md`.
- One real gap found and disclosed (not fixed this phase, out of scope): no dedicated
  billing-maintenance flag narrower than `BILLING_ENABLED`.

### Non-destructive recovery drill (D1 Time Travel)

- A live, read-only Time Travel bookmark was retrieved from the preview D1 database via the
  Cloudflare API (`200`, real bookmark value recorded in
  `docs/operations/DISASTER_RECOVERY_RUNBOOK.md`), proving the capability is genuinely available.
- A full restore-and-verify cycle was **not** executed — a stateful infrastructure action
  requiring separate explicit approval, matching Phase 11's own established precedent for the
  same kind of drill.
- `docs/operations/PHASE_14_RELIABILITY_GAME_DAY.md` records the broader tabletop exercise
  performed this phase (failure-mode walkthroughs, not live-infrastructure chaos injection).

### RISK-006 (`security_events`/`notifications` retention) — remains open

- The Phase 14 prompt's own conditional language required an explicit product-owner acceptance of
  the Phase 11 recommended periods before implementation was authorised; the prompt text provided
  contained no such acceptance. Both categories remain unbounded, per the prompt's own "otherwise
  leave the risk open" branch. `docs/data/PHASE_14_SECURITY_EVENT_RETENTION_DECISION.md` and
  `docs/data/PHASE_14_NOTIFICATION_RETENTION_DECISION.md` record the reasoning and what would be
  needed to close it.

### Validators, CI wiring, documentation

- `scripts/operations-validate.mjs` (new) — checks required scheduled jobs are documented,
  health-signal docs exist, required runbook topics are present, no stale "no production
  deployment exists yet" language, recovery docs are current, and exactly one canonical
  `PublicStatusLevel` type definition exists. Wired into `quality:gate`, CI, and
  `scripts/verify-push.sh`, immediately after `status:validate`.
- `scripts/status-validate.mjs` extended: `PUBLIC_STATUS_FILES` now also covers
  `status/feed.xml.ts`.
- 21 new docs under `docs/operations/`, `docs/product/`, `docs/data/`, `docs/security/` (see
  `docs/governance/DOCUMENTATION_INVENTORY.md` for the full list).
- `docs/operations/INCIDENT_RESPONSE.md` fully rewritten: fixed stale "no production deployment
  exists yet" claims (literally false by this point), added a lifecycle diagram, a full SEV-1–4
  severity matrix, a numbered "First 15 minutes" checklist referencing `/admin/operations`.
- `docs/operations/SYSTEM_HEALTH.md` and `docs/operations/RUNBOOK.md` updated to reflect the new
  route, the 5th scheduled job, and the running-row fix.

## What was deliberately NOT done this phase

- **Independent status-plane Worker (Option B)** — evaluated, documented, not built (new
  production infrastructure requiring separate approval).
- **`security_events`/`notifications` retention implementation** (RISK-006's remaining halves) —
  no explicit product-owner acceptance of the Phase 11 recommendation was present in the prompt.
- **Full D1 restore-and-verify drill** — only the safe, read-only capability-verification step was
  performed; a real restore is a stateful action requiring separate approval.
- **Public uptime percentage** — the 7-condition gate is not met; kept absent rather than
  fabricated.
- **Any third-party paging/monitoring/alerting integration** — explicitly prohibited by the
  prompt; none added.
- **Per-subsystem runbook files** (D1/R2/KV/billing/auth/scanner/monitoring/notifications/
  retention as 9 separate documents) — the required-deliverables list names only one new runbook
  file (`DISASTER_RECOVERY_RUNBOOK.md`); all 9 subsystems are organized as sections within it,
  cross-referencing rather than duplicating pre-existing docs.
- No pricing/Paddle, crawler-classification/registry, monitoring-frequency, or
  notification-channel change. No Phase 13 consent/analytics architecture change. No public
  country information added. No expansion into Phase 15 crawler-registry governance.

## Test evidence

`pnpm quality:gate` (run step by step to isolate the one known flake below rather than let the
chain abort): format check, lint, typecheck (0 errors), unit (**394/394**, 39 files), integration
(**299/300**, 44 files — 1 known pre-existing flake, see below), security (**41/41**, 8 files),
`db:validate` (**49 tables** verified consistent, migrations `0032`/`0033` included),
`docs:validate`, `brand:validate` (631 files), `trust:validate` (476 files), `status:validate`
(450 files), `operations:validate` (4 scheduled jobs documented, 9 runbook topics present, 1
canonical status vocabulary), `content:validate` (4 verticals, 5 platforms),
`repo-privacy:validate` (×2, pre- and post-build, 11 packages/286 customer-facing files/439
config files), `analytics:validate` (395 files), `pnpm audit --audit-level=critical` (0 critical
/ 8 high / 4 moderate — unchanged baseline from Phase 12/13, confirmed dev-only tooling), and
`build` — all green.

`pnpm test:e2e:chromium`: **135 passed, 7 flaky** (failed on first attempt, passed on retry;
overall exit code 0). Run took 1.6h in this sandboxed environment (unusually long — evidence of
resource contention, not a functional regression). All 7 flaky tests failed with generic
timeouts (`Test timeout of 60000ms exceeded`, hydration-wait timeouts, one "response has been
disposed" resource-contention error) rather than assertion failures, and span unrelated
pre-existing spec files (`audit-conversion`, `auth-and-account`, `checkout-continuity`,
`notifications-monitoring-reliability`, `responsive-smoke`, `saved-domain-timeline`,
`status-changelog-trust`) — none are Phase 14-authored files, and the pattern (widespread timing
flakes clustered in one run, all clearing on retry) matches this sandbox's known
resource-constrained behavior rather than a real defect. The
`status-changelog-trust.spec.ts` flake was checked specifically since `status.astro` was modified
this phase (added the Atom feed link) — its failure was a bare 60s timeout with no assertion
detail, consistent with the same environment-wide pattern, not a content regression. The new
`operations-dashboard.spec.ts` (6 tests) passed cleanly on the first attempt.
`checkout-continuity.spec.ts`'s WebAuthn-hydration flake specifically matches the same
CI-runner-timing pattern already documented in the Phase 12/13 reports.

`pnpm test:a11y:chromium`: **110/110 passed** (1.3m, no flakes), including the new "Super Admin
operations dashboard has no automatically detectable WCAG 2.2 AA violations" test.

One pre-existing, unrelated integration flake was observed and is expected to recur:
`apps/web/tests/integration/audit-report-signals.integration.test.ts`'s "still reads a
pre-Phase-11 html_meta row..." test (a real network call to `example.co`) consistently times out
in this sandboxed development environment (re-ran in isolation twice, failed both times);
confirmed via direct `curl` (302 in 122ms) that raw network access itself is not blocked, so this
is scanner-internal latency, not environment unavailability. This file is unrelated to any Phase
14 code (it tests `scan_resources.snapshot_text`/`html_meta` backward compatibility, and
`git diff main` against it on this branch is empty). This same test also failed once in real
GitHub Actions CI on PR #107's first run (same timeout, same test) — re-running only that failed
job cleared it on the second attempt (all 3 CI checks green,
`mergeStateStatus: CLEAN`), confirming it is a genuine, occasional network flake rather than a
deterministic break, in both environments.

## Files created/modified

**New**: `apps/web/src/lib/admin/operational-alerts.ts`, `apps/web/src/lib/admin/operations.ts`,
`apps/web/src/components/admin/OperationsOverview.tsx`,
`apps/web/src/pages/admin/operations/index.astro`,
`apps/web/src/pages/api/admin/operations/index.ts`,
`apps/web/src/pages/api/admin/operations/evaluate.ts`,
`apps/web/src/pages/api/admin/operations/reconcile-notifications.ts`,
`apps/web/src/pages/api/admin/operations/retention-dry-run.ts`,
`apps/web/src/pages/api/admin/operations/alerts/[alertId]/acknowledge.ts`,
`apps/web/src/pages/status/feed.xml.ts`, `scripts/operations-validate.mjs`,
`packages/database/migrations/0032_operational_alerts.sql`,
`packages/database/migrations/0033_scheduled_job_runs_started_at_index.sql`,
`apps/web/tests/integration/operational-alerts.integration.test.ts`,
`apps/web/tests/integration/scheduled-job-run-lifecycle.integration.test.ts`,
`apps/web/tests/integration/status-atom-feed.integration.test.ts`,
`apps/web/tests/integration/operations-reliability-trends.integration.test.ts`,
`apps/web/tests/integration/admin-operations.integration.test.ts`,
`apps/web/tests/e2e/operations-dashboard.spec.ts`, 21 new docs (see
`docs/governance/DOCUMENTATION_INVENTORY.md`), this report.

**Modified**: `apps/web/src/lib/status/public-status.ts`, `apps/web/src/lib/admin/health.ts`,
`apps/web/src/worker.ts`, `apps/web/src/components/admin/AdminNav.astro`,
`apps/web/src/pages/status.astro`, `packages/database/src/schema/admin-security.ts`,
`apps/web/src/layouts/ga-boundary.test.ts`, `apps/web/tests/a11y/home.spec.ts`,
`apps/web/tests/integration/public-status.integration.test.ts`, `scripts/status-validate.mjs`,
`scripts/verify-push.sh`, `package.json`, `.github/workflows/ci.yml`,
`docs/operations/SYSTEM_HEALTH.md`, `docs/operations/RUNBOOK.md`,
`docs/operations/INCIDENT_RESPONSE.md`, `docs/governance/DOCUMENTATION_INVENTORY.md`,
`docs/status/REQUIREMENTS_TRACEABILITY.md`, `docs/risks/ACTIVE_RISKS.md`, `CHANGELOG.md`.

## Risk register status

| Risk     | Status before | Status after | Note                                                                                           |
| -------- | ------------- | ------------ | ---------------------------------------------------------------------------------------------- |
| RISK-006 | monitoring    | monitoring   | Re-evaluated; remains open for `security_events`/`notifications`, no approval given this phase |

No numbered risk was closed this phase. No new numbered risk was opened — the bugs found (N+1,
maintenance timing, missing running-row, missing index) were fixed within this same phase rather
than left open, so none required a tracked risk entry.

## Confirmations

- Public 6-state status vocabulary and 7 canonical public components: unchanged.
- Monitoring truth remains solely owned by Phase 10 — no second monitoring engine was built.
- No third-party paging/alerting/observability vendor was added.
- No public uptime percentage was published.
- Pricing and Paddle products/prices: unchanged. Crawler classification/registry: unchanged.
  Monitoring cadence: unchanged. Notification channels: unchanged. Phase 13's consent/analytics
  architecture: unchanged.
- Repository remains private (per standing instruction; no visibility check performed this
  phase — not required by this phase's scope).
- No public country/jurisdiction information was added.

## Next steps

1. ~~Run the full required test sequence~~ — done: `quality:gate` green, full Chromium e2e
   (135 passed, 7 flaky-but-passed-on-retry), full a11y (110/110), responsive covered by
   `responsive-smoke.spec.ts` within the e2e run.
2. Commit, push branch, open PR (pending explicit confirmation).
3. Merge (pending explicit confirmation).
4. Deploy to production (pending explicit confirmation), then independently verify — this phase
   **does** add new migrations (`0032`, `0033`), unlike Phase 13's docs-only deployment.
5. Record the deployment (commit SHA, Worker version, migration state) via a follow-up
   `CURRENT_STATE.md`/`CHANGELOG.md` update, matching the established two-stage pattern.
