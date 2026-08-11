# Phase 14 Reliability Game Day

**Level 4 document.** Non-destructive reliability drills, per §110-112/§149 of the Phase 14 prompt.
Production was never intentionally broken. Each scenario below states honestly what was **actually
executed** (real command output) versus **reasoned from code** (a tabletop walkthrough against the
real, current implementation — not a live fault injection) — the two are never blurred together.

## What was actually executed this phase

**D1 Time Travel capability check (real, live, read-only)**: a real bookmark was retrieved from the
preview database via the Cloudflare API —
`GET /accounts/{account}/d1/database/e9c9f730-1f0d-4f4e-8775-db94126b12f0/time_travel/bookmark` →
`200 { "bookmark": "0000003e-00000000-000050c3-b6f079c2271acdef2f543a4229baac15" }`. This confirms
Time Travel is genuinely available on the preview database right now, not just documented as a
Cloudflare feature. **A full restore-and-verify cycle (restore to that bookmark, confirm
`pnpm db:validate` still passes afterward) was not executed this phase** — it is a real, stateful
write against a live Cloudflare resource, and per this repository's standing rule that actions with
real infrastructure blast radius get explicit, in-the-moment approval, it was not attempted without
that separate approval. This mirrors `docs/operations/PHASE_11_DATABASE_RECOVERY_RUNBOOK.md`'s own
prior, identical decision — the gap is carried forward, not newly introduced, and remains a named,
recommended follow-up.

**Real code verification** (not a simulation — actual passing tests against real D1 via the
Miniflare test harness): the scheduled-maintenance timing fix, the N+1 fix, and the
`scheduled_job_runs` running-row lifecycle were all verified with real integration tests inserting
real rows and asserting real query output — see the relevant `apps/web/tests/integration/*.ts`
files. These are not simulations of a scenario below; they are the actual regression tests for real
bugs found and fixed this phase.

## Scenario A — Worker deployment regression

**Reasoned from code, not executed.** Detection: `deploy-production.yml`'s own smoke-test step
(`scripts/smoke-test.ts`) runs post-deploy and fails the workflow if the deployed Worker doesn't
behave correctly; independently, `docs/operations/PHASE_14_STATUS_OPERATIONS_BASELINE.md`'s "Post-
-deployment observation" window covers the period immediately after. Operator surface: GitHub
Actions run history + `/admin/operations`'s scheduler/alert view. Expected alert: none automatic
(deployment health is not yet wired into `operational_alerts` — see "What was deliberately not
built" below). User impact: depends on the regression's nature — could range from none (a docs-only
change) to a full outage. Public status: would show `status_unavailable` if the regression breaks
the health-check query path itself, or specific component degradation otherwise. Mitigation:
redeploy the previous known-good commit. Recovery: confirmed via a fresh `smoke-test.ts` run against
production.

## Scenario B — D1 query failure

**Reasoned from code, partially exercised**: `getPublicStatus()`'s own `catch` block was read and
confirmed (not merely assumed) to set every component to `status_unavailable` on any query failure,
never a false "operational" — this exact behaviour is covered by existing, real, passing tests in
`apps/web/tests/integration/public-status.integration.test.ts` (though those tests exercise
specific data conditions, not a literal D1 connection failure, which the Miniflare test harness
cannot simulate). Operator surface: `/status` itself shows "Status information is temporarily
unavailable." Expected alert: none in `operational_alerts` (D1 failure prevents the evaluator
itself from running). User impact: full status-page unavailability, and likely broader product
impact since D1 is the only datastore. Mitigation: Cloudflare-side D1 incident response (no
application-level workaround exists).

## Scenario C — Scheduled monitoring missed

**Reasoned from code, backed by a real test**: `detectSchedulerAnomalies`'s "missed" detection was
verified this phase against real D1 rows (`apps/web/tests/integration/scheduled-job-run-lifecycle.integration.test.ts`
covers "stuck" and "overlapping"; "missed" uses the same `EXPECTED_INTERVAL_MS` logic, already
covered by this codebase's pre-existing `admin-jobs`-adjacent test coverage). Operator surface:
`/admin/operations`'s "Scheduler anomalies" section, plus a `scheduler.missed.monitoring_sweep`
operational alert (critical severity) once the daily evaluator runs. User impact: delayed policy-
-change detection for scheduled-monitoring customers, not a product outage — audits still work
manually. Public status: unaffected (deliberately `publicImpact: false` for this specific signal —
see `SERVICE_HEALTH_SIGNAL_MODEL.md` "Monitoring"). Mitigation: investigate why the daily cron
didn't fire (Cloudflare Cron Trigger dashboard) or why `runMonitoringJob` didn't complete
(`scheduled_job_runs.error_summary`).

## Scenario D — Paddle webhook platform failure

**Reasoned from code**: `getComponentHealth`'s webhook-failure counting and the
`billing.webhook_processing_failures` operational alert (≥3 failures/hour) were verified this phase
against real inserted `webhook_events` rows (`apps/web/tests/integration/operational-alerts.integration.test.ts`).
Operator surface: `/admin/webhooks`, `/admin/operations`. User impact: below 3 failures, none
publicly visible (correctly — Paddle retries delivery); at ≥3, the public "Billing and checkout"
component degrades. Mitigation: `/admin/webhooks`'s retry action, or wait for Paddle's own retry.

## Scenario E — Scanner canary failure

**Not applicable — no scanner canary exists.** See `docs/operations/PUBLIC_COMPONENT_SIGNAL_MAPPING.md`
"Why `website` and `audit_scanner` have no signal yet" for why this was evaluated and deliberately
not built this phase. If a canary existed, its expected response would be: detection via a failed
scheduled synthetic scan against a controlled fixture; operator surface, a new alert type; user
impact assessment via comparison against real customer scan failure rates
(`capacity.monitoring.platformFailureCountLast24h`, which already exists and would be the first
real signal of a widespread scanner regression today, in its absence).

## Scenario F — Public status DB unavailable

Same as Scenario B — `/status` and the internal D1 health check share the exact same failure mode
(no separate datastore exists for status specifically). See
`docs/operations/PHASE_14_INDEPENDENT_STATUS_PLANE_DECISION.md` for the correlated-failure risk
this implies and why it was not addressed with a separate status plane this phase.

## Scenario G — Public incident management

**Reasoned from code, backed by real tests**: incident create/publish/update/resolve flows were
verified this phase (see `apps/web/tests/integration/admin-incidents.integration.test.ts`,
pre-existing, and the new maintenance-timing test in `public-status.integration.test.ts`). Operator
surface: `/admin/incidents`. Detection: manual (an administrator observing real impact, or an
operational alert prompting investigation) — this codebase deliberately never auto-publishes a
public incident from a single failed health check (§24). Expected outcome: a draft (`is_public =
false`) incident never appears on `/status` or the Atom feed until explicitly published — verified
by real, passing tests in both `apps/web/tests/integration/admin-incidents.integration.test.ts`
("a non-public incident never appears in the public status computation") and the new
`apps/web/tests/integration/status-atom-feed.integration.test.ts`.

## What was deliberately not built

**Deployment-health-to-operational-alert wiring** (Scenario A's "no automatic alert" gap above): a
deployment marker/health-check pipeline that automatically opens an `operational_alerts` row after
a bad deploy was evaluated (§56-59) and not built — see
`docs/operations/PHASE_14_STATUS_OPERATIONS_BASELINE.md` for why deployment SHA/version isn't even
obtainable from inside the Worker today, which is the actual blocker (there is no in-Worker signal
to alert on). The existing `deploy-production.yml` smoke-test gate is the real, current safeguard.
