# Phase 11 scheduled-job separation decision

Stage 11E. Whether `monitoring_sweep`, `data_retention_purge`, and `scheduled_plan_changes` should
share one Cron Trigger invocation or run on separate triggers — reassessed with real numbers, not
carried forward unexamined, now that a third job (`scheduled_plan_changes`, Phase 6) exists
alongside the two the original design considered.

## Current state (real, from `wrangler.jsonc` and `worker.ts`)

- **One Cron Trigger**: `"0 3 * * *"` (daily, 03:00 UTC) — 1 of the account's 5 Free-plan Cron
  Trigger slots used, 4 free (confirmed live via Cloudflare API,
  `docs/performance/PHASE_11_PRODUCTION_CAPACITY_BASELINE.md` §8.1).
- **Three jobs fire from that one trigger**, each via its own `ctx.waitUntil(...)` inside the same
  `scheduled()` invocation: `runRetentionJob` (always), `runScheduledDowngradesJob` (gated on
  `BILLING_ENABLED`), `runMonitoringJob` (gated on `AUDIT_ENGINE_ENABLED`, plus the maintenance/
  scheduler-pause check).
- Each is recorded as its own `scheduled_job_runs` row (separate `job_name`), so failure isolation
  at the _reporting_ level already exists — a failure in one job's row is never hidden by
  another's success. What is **not** separated is the CPU/wall-clock budget: `ctx.waitUntil` lets
  each job continue after the handler returns, but all three still execute within the resource
  limits of the _same_ Worker invocation that the one Cron Trigger firing created.

## The real tradeoff

**Bundled (current)**: all three jobs share one invocation's CPU/time budget. At today's volume
(2 users, 9 domains, per the Stage 11A baseline) this is nowhere near a limit — `runMonitoringJob`
processes at most `monitoring_scan_batch_size` (20 by default) domains, `runRetentionJob` is now
chunk-bounded (Stage 11D, ≤20 chunks × 500 rows per category), and `runScheduledDowngradesJob`
processes only domains with a scheduled downgrade actually due (typically zero to a handful).
Uses only 1 of 5 available Cron Trigger slots.

**Separated (one trigger per job, or per job-pair)**: each job gets its own invocation and its own
independent CPU/time budget — a large monitoring backlog can no longer compete with retention or
plan-change processing for the same invocation's resources. Costs 2–3 of the 5 available slots
instead of 1.

## Why this isn't split now

RISK-008's own framing already applies here: this is "certain at the SRS's own 150+/1,000-domain
commercial target; low at current real volume." Splitting triggers is real, if small, additional
operational surface (three cron schedules to reason about instead of one, three separate
`scheduled_job_runs` timing windows to monitor for overlap) for a contention problem that doesn't
exist yet — `runMonitoringSweep`'s own chunk/batch bound (§ Stage 11E fair-scheduling fix, above)
and `runDataRetentionPurge`'s new chunk bound (Stage 11D) already cap each job's own worst-case
cost per run independent of trigger topology. Splitting triggers addresses _cross-job_ contention,
which requires enough combined volume for retention and monitoring to actually compete for the
same invocation's CPU — not yet the case.

## The concrete trigger for revisiting this

Split into separate Cron Triggers when **either**:

1. `scheduled_job_runs` shows retention or plan-change job durations regularly overlapping with
   monitoring sweep durations in a way that suggests resource contention (visible today via
   `getComponentHealth`'s job-status data — `apps/web/src/lib/admin/scheduler.ts` already flags
   `long_execution` anomalies over a threshold), **or**
2. Real domain/scan volume approaches the thresholds already tabulated in
   `docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md` (CPU-time-per-invocation, Worker invocation
   count) — at which point a single bundled invocation's total cost, not just monitoring's share
   of it, becomes the thing to re-measure.

If/when that happens, the concrete split (documented here so it's not new design work under
pressure later): monitoring stays on `"0 3 * * *"`; retention and scheduled plan changes move to a
second trigger, e.g. `"0 4 * * *"` (staggered an hour later, not concurrent — avoids the two
invocations racing each other via `ctx.waitUntil` timing, and gives retention's now-real chunk-cap
backlog-remaining signal, Stage 11D, room to resolve across a few runs without competing with the
next day's monitoring sweep). This uses 2 of the account's 5 Free-plan Cron Trigger slots, still
comfortably under the "needing a 6th schedule" upgrade trigger already documented.

## Batch default reassessment (`MAX_DOMAINS_PER_SWEEP` / `monitoring_scan_batch_size`)

Real `scheduled_job_runs` history (§8.4 of the Stage 11A baseline doc, 18 real rows) shows the
largest real sweep to date selected **4 domains** — a fifth of the current default of 20, and the
batch cap has never been observed to bind in production. There is no real evidence this phase
found to justify lowering the default; it is already runtime-configurable
(`monitoring_scan_batch_size`, SRS §28.16) without a redeploy if a future operator needs to tune
it down ahead of measured contention. The default (20) is left unchanged — the real gap this phase
found and fixed was fairness within that batch (above), not its size.

## What this phase changed as a direct result

- Confirmed (not assumed) the real current cron/job topology via `wrangler.jsonc` and `worker.ts`,
  correcting any stale assumption that a job-separation decision was already made.
- Bounded each job's own worst-case per-invocation cost independent of trigger topology
  (`runDataRetentionPurge`'s chunking, Stage 11D; `runMonitoringSweep`'s existing
  `monitoring_scan_batch_size` cap, now also fairness-ordered, Stage 11E) — the prerequisite for
  either "stay bundled" or "split later" to be a safe choice rather than a guess.
- Recorded the concrete split design and its two triggers so a future author facing real
  contention evidence doesn't have to re-derive the tradeoff from scratch.
