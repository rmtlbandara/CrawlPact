# Phase 09 — Import and Bulk Job Retention

Per Phase 11 retention principles (`docs/data/DATA_RETENTION.md`,
`docs/data/PHASE_11_RETENTION_DECISION_MATRIX.md`): bounded, chunked, dry-run-capable, failure-
isolated per category — this phase's two new categories join the existing
`runDataRetentionPurge` runner rather than inventing a second retention mechanism.

## What is stored

- `portfolio_import_jobs` — job summary only (see `CSV_IMPORT_WORKFLOW.md` §Storage). No raw CSV
  content, ever.
- `portfolio_import_rows` — per-row outcome only: row number, normalised origin, result code,
  error code, resulting `domain_id`. No original arbitrary row data, no notes/display-name field
  values beyond what's needed to explain the outcome (the outcome itself doesn't need the input
  value repeated — the UI already showed it during preview).
- `bulk_action_jobs` — job summary for idempotency + audit (`BULK_ACTION_MODEL.md`): action type,
  domain-ID count (not the IDs themselves once complete — see below), result counts, idempotency
  key, timestamps.

## Retention windows

| Data                                              | Window                                                                                                                                                                                                                                                                 | Rationale                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `portfolio_import_jobs` / `portfolio_import_rows` | 90 days from `completed_at`                                                                                                                                                                                                                                            | Long enough for a user to review what an import did weeks later (matches the existing shared-report default expiry order of magnitude); short enough that it isn't indefinite. Not tied to plan-based history retention (`plans.history_retention_days`) since import jobs are an operational record, not audit-evidence history. |
| `bulk_action_jobs`                                | 90 days from `completed_at`                                                                                                                                                                                                                                            | Same rationale — operational record, not evidence.                                                                                                                                                                                                                                                                                |
| Uploaded CSV file content                         | **Never stored** — exists only in request memory during `preview`/`confirm`, discarded when the request completes. Nothing to purge.                                                                                                                                   |
| Idempotency keys                                  | Live exactly as long as their parent job row — once the job is purged, a since-reused key is no longer checked against it (a very old accidental retry is treated as new, which is safe: it would simply re-validate against current state, same as any fresh import). |

## Cleanup process

A third category, `import_and_bulk_job_records`, is added to `runDataRetentionPurge`
(`apps/web/src/lib/data-retention.ts`), following the exact existing pattern: bounded chunked
`DELETE ... LIMIT`, dry-run support, its own `CategoryResult`, isolated from the other categories'
failures. `portfolio_import_rows` and `bulk_action_jobs`' per-domain detail (if any transient
in-flight detail were ever added) cascade via `ON DELETE CASCADE` from their parent job row, so
this is a single bounded delete per category, not a fan-out loop.

## R2 (agency-branding profile logo)

Not affected by this document — profile-logo lifecycle is covered by `AGENCY_BRANDING_MODEL.md`'s
R2 lifecycle correction and the existing `findAndCleanupOrphanedLogos` sweep, now wired into the
daily cron (see the completion report's Database section) rather than left as a manual-only admin
action — this is this phase's closure of RISK-010.

## User-visible history period

The workspace UI shows "Import history" for the same 90-day window the data actually exists for —
never implies a longer history is available than what's retained.
