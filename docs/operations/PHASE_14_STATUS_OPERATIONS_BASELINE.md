# Phase 14 Status/Operations Baseline

**Level 4 document.** Phase 14 (Status, Operations and Service Reliability). Records what already
existed before this phase touched anything — the required preflight evidence, not a redesign.

## Existing public status route

`apps/web/src/pages/status.astro` — `export const prerender = false`, fully SSR, computed per
request via `await getPublicStatus(db)`. No client JS/hydration (zero `client:*` directives) — pure
server-rendered HTML.

## Existing status response time / query cost (before this phase)

`getPublicStatus()` (`apps/web/src/lib/status/public-status.ts`) called `loadPublicIncidents()`
twice (`"active"` and `"resolved"`) and, inside each call, issued **one separate
`SELECT ... FROM incident_updates` per incident** — a real N+1. Fixed this phase; see
`docs/data/PHASE_14_OPERATIONS_QUERY_AND_INDEX_AUDIT.md`.

## Existing cache policy

`/status`: `Cache-Control: public, max-age=30` (`status.astro:14`). Already close to the Phase 14
prompt's own suggested `s-maxage=30, stale-while-revalidate=30` — left unchanged; see
`docs/operations/PHASE_14_STATUS_OPERATIONS_BASELINE.md`'s own recommendation not to add
stale-while-revalidate to a route that already recomputes on every request server-side (no shared
CDN cache layer sits in front of it distinct from Cloudflare's own edge cache, which already
respects `max-age`).

## Existing component mappings (before this phase)

Only 3 of the 7 public components had a mapped internal signal
(`INTERNAL_COMPONENT_MAP` in `public-status.ts`): `scheduled_monitoring` → "Scheduler / monitoring
sweep", `billing_checkout` → "Paddle webhook processing", `accounts_passkeys` → "Authentication".
See `docs/operations/PUBLIC_COMPONENT_SIGNAL_MAPPING.md` for the full, current mapping (unchanged
by this phase — see that document for why expanding it further isn't justified yet).

## Existing internal checks

`apps/web/src/lib/admin/health.ts`: `getSystemStatusSummary()` (maintenance-mode short-circuit,
job-failure/stuck detection over the last 20 `scheduled_job_runs` rows, invalid-Paddle-signature
rate) and `getComponentHealth()` (6 named components: D1 database, API, Scheduler / monitoring
sweep, Data retention job, Paddle webhook processing, Authentication).

## Existing public-impact mappings

`ComponentHealth.publicImpact` (boolean) — the single enforcement point deciding whether an
internal `degraded` signal is allowed to escalate the public page. Already fixed a real production
bug before this phase (a week-old, already-resolved batch of webhook failures had been permanently
degrading the public "Billing and checkout" component with no time window) — see
`docs/reports/PUBLIC_STATUS_AND_CHANGELOG_TRUST_CORRECTION_REPORT.md`.

## Existing admin health views

`/admin/health` (`HealthOverview.tsx`) — public+internal status side by side, per-component detail.
No unified operations view existed before this phase (`/api/admin/capacity` had a working backend
but **no consuming UI page at all** — a real, confirmed gap this phase closes with `/admin/operations`).

## Existing status incidents

Real schema (`packages/database/migrations/0018_incidents.sql`,
`packages/database/src/schema/incidents.ts`): `incidents` (severity/status/is_public/
is_scheduled_maintenance/starts_at/resolved_at) and append-only `incident_updates`. Admin API/UI
already existed (`/admin/incidents`, `IncidentsManager.tsx`) with full audit logging via
`requireAdminAction`.

## Existing maintenance support

`incidents.is_scheduled_maintenance` (same table, same workflow states, rendered in a distinct
"Scheduled maintenance" page section). **Found and fixed this phase**: a scheduled-maintenance
record with a future `starts_at` was escalating the affected component to "Maintenance" the moment
it was created, not when its start time actually arrived — see the maintenance-timing test in
`apps/web/tests/integration/public-status.integration.test.ts` and the fix in `public-status.ts`.

## Existing operational metrics

`apps/web/src/lib/admin/capacity.ts`'s `getOperationalCapacitySnapshot()` (Phase 11, Stage 11H) —
D1 table count, R2 object count, scan volume/cost, monitoring backlog, notification/retention
health, abuse-monitoring counts, agency-workspace usage. Real, live-queried, with honest `null`s
for genuinely unobtainable Worker-binding metrics (Cloudflare plan, Worker CPU-limit errors, bundle
size).

## Existing Cron jobs

One trigger, `wrangler.jsonc`: `"0 3 * * *"` (daily, 03:00 UTC). Four jobs fire from the same
`scheduled()` invocation via separate `ctx.waitUntil()` calls: `runRetentionJob` (unconditional),
`runScheduledDowngradesJob` (gated on `BILLING_ENABLED`), `runMonitoringJob` +
`runNotificationReconciliationJob` (gated on `AUDIT_ENGINE_ENABLED`). Phase 14 adds a fifth,
`evaluateOperationalAlerts`, to the same invocation — see
`docs/operations/PHASE_14_SCHEDULED_JOB_ISOLATION_DECISION.md`.

**Found and fixed this phase**: no code path ever wrote a `scheduled_job_runs` row with
`status = 'running'` before a job completed — every insert happened post-hoc, after the job's own
try/catch resolved. This made `detectSchedulerAnomalies()`'s "stuck"/"overlapping" detection
(`lib/admin/scheduler.ts`) structurally unreachable against real data (a Worker that died mid-job
left no trace at all). `worker.ts`'s jobs now insert a real `running` row first
(`startJobRun`/`finishJobRun`) and update it in place — see
`apps/web/tests/integration/scheduled-job-run-lifecycle.integration.test.ts`.

## Existing runbooks (before this phase)

`docs/operations/INCIDENT_RESPONSE.md` — **stale**: contained "No production deployment exists
yet" and "nothing has been deployed to any live environment" (both false; production has been live
since 2026-07-26 with real customer-facing Paddle billing). Fixed this phase.
`docs/operations/RUNBOOK.md` — largely accurate, already self-flags its own stale manual-deploy
section. `docs/operations/BACKUP_AND_RECOVERY.md` — accurate, honestly discloses the D1 recovery
drill has never actually been run.

## Existing recovery mechanisms

Cloudflare D1 Time Travel (point-in-time recovery) — **re-verified live this phase**: a real
bookmark was retrieved from the preview database (`crawlpact-db-preview`,
`GET /accounts/{account}/d1/database/{id}/time_travel/bookmark` → `200`), confirming the capability
is genuinely available, not just documented. A full restore-and-verify cycle was not executed this
phase (see `docs/operations/PHASE_14_RELIABILITY_GAME_DAY.md` for what was and wasn't performed and
why). Registry-release rollback and Paddle subscription resync (both application-level, D1-Time-
-Travel-independent) already exist and are already tested.

## Current status limitations (as of this baseline)

- No public uptime percentage exists or is planned this phase (no reliable measurement history) —
  see `docs/product/PHASE_14_PUBLIC_UPTIME_PERCENTAGE_DECISION.md`.
- No public status Atom feed existed before this phase (explicitly deferred as a "fast-follow" by
  the original incident-tracking design doc) — built this phase, see
  `apps/web/src/pages/status/feed.xml.ts`.
- `/status` shares the main Worker and main D1 database with the rest of CrawlPact — a real,
  disclosed correlated-failure risk, not fixed this phase — see
  `docs/operations/PHASE_14_INDEPENDENT_STATUS_PLANE_DECISION.md`.
