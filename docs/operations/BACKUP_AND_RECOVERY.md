# Backup and Recovery

## Current state (2026-07-27)

~~No production D1 database exists yet~~ — **superseded 2026-07-26**: a real production D1
database (`crawlpact-db`) exists, migrated and bound to the live `crawlpact-web` Worker (see
`docs/deployment/CLOUDFLARE_CONFIGURATION.md`). The policy below is the current, active policy
for it, not a future target. No backup/recovery drill against this real database has been run yet
— see `docs/status/KNOWN_RISKS.md`.

## D1 backup approach

Cloudflare D1 supports point-in-time recovery via its own platform mechanism (`wrangler d1
time-travel`). **Verified retention window (2026-07-26, see
`docs/deployment/CLOUDFLARE_RESOURCE_LIMITS.md` #17): 7 days on the Free plan, 30 days on Paid** —
up to 10 restore operations per 10 minutes per database. Re-verify this window against
Cloudflare's official documentation before relying on it in an actual incident, since platform
capabilities and retention windows can change over time; do not assume the figure above stays
current indefinitely.

**Operational implication**: any data-integrity incident discovered more than 7 days after the
fact (Free plan) cannot be recovered via Time Travel at all. Combined with the data-retention
purge (`lib/data-retention.ts`, runs daily), this is a real, narrow recovery window — worth
factoring into how quickly anomalies need to be noticed, not just how they'd be fixed once found.

## R2 backup

**Not applicable.** Per `docs/data/D1_R2_DATA_PLACEMENT_POLICY.md` (2026-07-26), R2 is not
currently adopted — there are no objects to back up, version, or reconcile against D1 references.
If R2 is ever adopted (see that document's revisit triggers), this section must be updated with:
an object-versioning decision, accidental-deletion protection, an orphan/missing-object detection
procedure reconciling R2 keys against their D1 metadata rows, and a restore procedure — none of
which exist today because there is nothing to restore.

## What is not backed up by the platform

Nothing outside D1 needs backing up in this architecture: there is no separate file store for
scan snapshots (they live in `scan_resources.snapshot_text`, inside D1) and no external
database. This is a deliberate simplicity benefit of the single-D1-database architecture
(ADR-0001/0002), reaffirmed as still true by the 2026-07-26 Cloudflare architecture audit
(`docs/deployment/CLOUDFLARE_ARCHITECTURE_AUDIT.md`).

## Other recovery procedures (already implemented, not new)

- **Registry release rollback**: Super Admin's registry administration (`lib/admin/registry.ts`,
  SRS §28.11) supports rolling back a published registry/ruleset release to the immediately prior
  version, with domain re-evaluation triggered on rollback — this is an application-level
  recovery mechanism independent of D1 Time Travel, already built and tested
  (`admin-registry.integration.test.ts`).
- **Subscription reconciliation with Paddle**: Super Admin's "Paddle resync" action
  (`lib/admin/subscriptions.ts`, SRS §28.5) re-fetches a subscription's real state directly from
  Paddle's API, correcting local D1 drift without needing a database restore — the correct
  recovery path for billing-state discrepancies specifically, distinct from a full database
  restore.

## Recovery drill (tabletop exercise — to be performed before production launch)

A real production database exists (since 2026-07-26), but this drill has still not actually been
run against it — this section intentionally contains no fabricated results. The drill should walk
through each of the following scenarios and record actual command output/timing:

1. **D1 point-in-time restore**: use `wrangler d1 time-travel restore` against the **preview**
   database (never rehearse against production) to confirm the procedure works end-to-end within
   the verified 7-day window. Confirm migrations still apply cleanly to the restored database
   afterward (`pnpm db:validate` should still pass).
2. **Registry rollback under pressure**: simulate a bad registry release (e.g. via a preview-only
   test publish) and confirm the rollback path in Super Admin actually reverts affected domains'
   evaluations, not just the registry metadata itself.
3. **Billing-state drift**: simulate a Paddle webhook that was missed or processed out of order
   in preview, then confirm the "Paddle resync" action correctly reconciles local state against
   Paddle's own record.
4. **Account-deletion cascade correctness**: re-run (in preview) the same scenario that originally
   surfaced the Part 3 Step 21 actor-reference bug (deleting an account with billing/scan/admin
   history) and confirm it completes without error and without deleting records that should
   survive — a regression check for that fix, not a new procedure.
5. **Time-boxing**: record how long each of the above actually takes in preview, so the runbook's
   incident-response time estimates are based on a real measurement, not a guess.

Document actual command output and timing here once performed.

## Local development

Local D1 state lives in `apps/web/.wrangler/` (gitignored). Losing it only affects local
development — recreate with `pnpm db:migrate && pnpm db:seed`.
