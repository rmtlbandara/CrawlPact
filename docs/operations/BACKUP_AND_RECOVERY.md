# Backup and Recovery

## Current state (Part 3)

No production D1 database exists yet — there is nothing to back up in a live environment. This
remains true through Part 3; nothing here has changed structurally since Part 1, the schema has
simply grown (12 forward-only migrations as of Part 3 Step 19, all applying cleanly to a fresh
database — verified by `pnpm db:validate` and by every integration test run against a real,
freshly-migrated D1 instance). This document still defines the target policy for when a
production database exists.

## D1 backup approach

Cloudflare D1 supports point-in-time recovery via its own platform mechanism (`wrangler d1
time-travel`) for the retention window Cloudflare provides at the time of use — verify the
current window against Cloudflare's official documentation before relying on it, since platform
capabilities and retention windows can change.

## What is not backed up by the platform

Nothing outside D1 needs backing up in this architecture: there is no separate file store for
scan snapshots (they live in `scan_resources.snapshot_text`, inside D1) and no external
database. This is a deliberate simplicity benefit of the single-D1-database architecture
(ADR-0001/0002).

## Recovery drill (to be performed before production launch)

1. Use `wrangler d1 time-travel restore` against a preview database to confirm the procedure
   works end-to-end.
2. Confirm migrations still apply cleanly to a restored database.
3. Document actual command output and timing here once performed — this section intentionally
   has no fabricated "drill results" yet.

## Local development

Local D1 state lives in `apps/web/.wrangler/` (gitignored). Losing it only affects local
development — recreate with `pnpm db:migrate && pnpm db:seed`.
