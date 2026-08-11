# Public/Internal Status Boundary

**Level 2 document.** Phase 14. Defines exactly what internal operations may expose (only to an
authenticated Super Admin) versus what the public `/status` page and its Atom feed may ever show.
Enforced structurally, not just by convention — see "Enforcement" below.

## Internal operations may expose (Super Admin only, never public)

- D1 state (table count, reachability)
- Scheduler job names, run history, anomaly detections (`missed`/`overlapping`/`stuck`/
  `long_execution`/`excessive_failure_rate`)
- Worker/API failures
- Cron/job failures
- Retention job failures and per-category counts
- Webhook processing counts (exact counts, not just a status chip)
- Authentication failure counts
- Monitoring backlog (due-now count, oldest-overdue timestamp, paused-domain count)
- Reconciliation state (notification reconciliation last run)
- Deployment SHA / Worker version (not actually obtainable from inside the Worker itself — see
  `docs/operations/PHASE_14_STATUS_OPERATIONS_BASELINE.md` "Existing recovery mechanisms";
  documented as unavailable rather than fabricated)
- Database migration count
- Capacity thresholds (R2 object counts, agency-workspace usage)
- Deduplicated operational alerts (`operational_alerts` table — key, severity, source, detail,
  occurrence count)

## Public status may expose only

- Customer-facing component (the 7 canonical keys/labels — `lib/status/components.ts`)
- Status (the 6-state public vocabulary)
- Incident title
- Plain-language public summary (never the internal detail string)
- Incident lifecycle (investigating/identified/monitoring/resolved)
- Scheduled maintenance (title, summary, start time, affected components — never internal reason)
- Relevant public timestamps (checked-at, incident/update timestamps)
- Resolution updates

**Never publicly exposed**: internal event counts (e.g. "3 webhook failures"), infrastructure
identifiers (job names, table names, D1 error text), risk IDs, security-event types, customer
domains, admin usernames.

## Enforcement

1. **Separate read paths, not a shared object with a public/private flag.**
   `lib/status/public-status.ts` only ever reads `incidents.is_public = 1` rows and only ever
   returns the fields in `PublicIncident`/`PublicComponentStatus` — it has no code path that could
   accidentally return an internal-only field, because those fields don't exist on its return
   types at all (a TypeScript compile-time boundary, not just a runtime filter).
2. **`ComponentHealth.publicImpact`** is the single gate deciding whether an internal `degraded`
   signal is allowed to influence the _public_ level at all (`lib/admin/health.ts`,
   `lib/status/public-status.ts`'s escalation logic). An internal `degraded` with
   `publicImpact: false` never reaches `getPublicStatus()`'s output.
3. **`getStatusOverview()`** (Super Admin only, `/api/admin/health`, `/api/admin/operations`) is
   the one place internal and public views are shown side by side — it is never rendered on
   `/status` itself, and its own route requires `requireAdminSession`.
4. **`pnpm analytics:validate`-style static scanning** — `pnpm status:validate`
   (`scripts/status-validate.mjs`) statically checks the public status source for internal-metric
   leakage; extended this phase (see `docs/operations/PHASE_14_STATUS_OPERATIONS_BASELINE.md`).
5. **The public status Atom feed** (`apps/web/src/pages/status/feed.xml.ts`, new this phase) reuses
   `getPublicStatus()` directly — it cannot leak anything the HTML page itself couldn't, by
   construction (same data source, same type boundary).

## Escalation rule (restated, already enforced)

> An internal problem may escalate public status only when there is evidence of real or highly
> probable user impact (`publicImpact: true`).

> Failure to determine health must never silently become "Operational" — `getPublicStatus()`'s own
> `catch` block sets every component to `status_unavailable`, never a default "healthy" guess.
