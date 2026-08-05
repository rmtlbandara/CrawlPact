# Phase 11 database recovery runbook

Stage 11H. Re-verifies and consolidates `docs/operations/BACKUP_AND_RECOVERY.md` for this phase's
own changes (Stage 11D retention hardening, the Stage 11A real capacity baseline) — it does not
replace that document, which remains the canonical backup/recovery policy; this is the Phase 11
verification pass against it.

## D1 Time Travel — what this phase re-checked

`BACKUP_AND_RECOVERY.md` documents a 7-day (Free) / 30-day (Paid) Time Travel retention window,
verified 2026-07-26. This phase attempted a fresh live re-verification of that specific figure via
the same documentation search tool used for the broader Cloudflare limits re-check
(`docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md`'s re-verification note) — unlike the Workers/D1/
R2 usage limits, which returned clear, direct confirmation, the Time Travel retention-window figure
specifically did not surface a definitive result from this session's search tool. **This figure is
therefore carried forward as previously documented, not freshly re-confirmed** — the honest
distinction this document exists to make explicit, rather than silently presenting a 10-day-old
number as freshly verified. Re-check `developers.cloudflare.com/d1/reference/time-travel/` directly
before relying on this window in an actual incident.

## What changed this phase that affects recovery posture

- **Retention purging is now chunked and bounded** (Stage 11D,
  `docs/data/PHASE_11_RETENTION_DECISION_MATRIX.md`) — a real, evidenced consequence for recovery:
  before this phase, a single unbounded retention run could in principle delete an unbounded number
  of rows in one invocation; now each category is capped per run
  (`RETENTION_CHUNK_SIZE` × `RETENTION_MAX_CHUNKS`, 500 × 20 by default). This _reduces_ the blast
  radius of a retention-logic bug discovered late — at most 10,000 rows/category are affected before
  the next `scheduled_job_runs` row would surface the anomaly (via
  `docs/operations/PHASE_11_OPERATIONAL_CAPACITY_VIEW.md`'s `retention.lastRun` field or the
  existing admin jobs view), not the entire eligible backlog at once.
- **Retention now supports a real dry-run mode** (`runDataRetentionPurge(db, now, { dryRun: true
})`) — usable as a pre-incident verification step: before trusting a retention-logic change,
  run it in dry-run against a real (preview) database and inspect `wouldAffect` counts per category
  before ever setting `dryRun: false`.
- **D1 storage headroom is enormous relative to any plausible accidental-deletion scenario**
  (Stage 11A baseline: 3.3 MB of a 500 MB per-database cap, 0.66%) — a full accidental wipe of the
  current production database would need to be restored from a Time Travel bookmark taken within
  the last 7 days (Free plan); given current real write volume (§8.4 of the baseline doc: at most 4
  domains scanned in a single sweep to date), that window comfortably covers this account's actual
  usage pattern.

## Recovery drill — status

`BACKUP_AND_RECOVERY.md`'s own "Recovery drill (tabletop exercise — to be performed before
production launch)" section remains **not yet performed** as of this phase. Production has been
live since a prior phase (see the repo's own commit history — `docs/status/CURRENT_STATE.md`
tracks the exact deployment history), which means this drill is now overdue relative to its own
"before production launch" framing, not just a forward-looking checklist item.

**This phase deliberately does not run it.** Running scenario 1 of that drill
(`wrangler d1 time-travel restore` against the preview database) is a real, stateful infrastructure
operation against a live Cloudflare resource — distinct in kind from every other change in this
phase, which are either code changes verified by this repo's own test suite, or read-only
production measurements. Per this repo's standing rule that actions with real infrastructure blast
radius get explicit, in-the-moment approval rather than being bundled into a large hardening pass,
this is recorded here as a clear, named follow-up rather than either skipped silently or attempted
without that approval.

**Recommended next step**: run `BACKUP_AND_RECOVERY.md`'s full 5-scenario drill against the preview
environment as a dedicated, explicitly-approved follow-up — ideally before the next Cloudflare
plan-decision review (`docs/operations/PHASE_11_CLOUDFLARE_PLAN_DECISION.md`), since a real Time
Travel restore timing measurement would also inform that document's next revision.

## Cross-references

- `docs/operations/BACKUP_AND_RECOVERY.md` — canonical policy, not superseded by this document.
- `docs/data/PHASE_11_RETENTION_DECISION_MATRIX.md` — what's retained/purged and why.
- `docs/operations/PHASE_11_OPERATIONAL_CAPACITY_VIEW.md` — the real-time way to check retention
  job health (`retention.lastRun`) without waiting for an incident to surface it.
