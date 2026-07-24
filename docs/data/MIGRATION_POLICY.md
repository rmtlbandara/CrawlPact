# Migration Policy

## Rules

1. Migrations are hand-authored SQL in `packages/database/migrations/NNNN_description.sql`,
   applied only via `wrangler d1 migrations apply` (ADR-0002). Never use `drizzle-kit push` or
   any tool that edits a remote schema outside this path.
2. Migrations are **forward-only**. A mistake in an already-applied migration is fixed by a new
   migration, never by editing the applied file — D1's `d1_migrations` tracking table assumes
   migrations are immutable once applied.
3. Every new/changed table must be mirrored in `packages/database/src/schema/*.ts` in the same
   change. Run `pnpm db:validate` before committing — it fails the build if the two diverge.
4. No direct production schema edits. Every change goes through a migration file, reviewed like
   any other code change, applied to preview before production.
5. Number migrations sequentially (`0009_...`, `0010_...`); do not reuse or renumber existing
   files.
6. **SQLite table-rebuild migrations (changing a column's FK behavior, or anything else `ALTER
TABLE` can't do directly) must use `PRAGMA defer_foreign_keys=ON`, never
   `PRAGMA foreign_keys=OFF`.** D1 runs an entire migration file as one implicit transaction, and
   SQLite silently no-ops `foreign_keys` pragma changes made mid-transaction — a migration using
   `foreign_keys=OFF` can pass against a fresh `sqlite3` CLI database (autocommit, no wrapping
   transaction) and still fail with `SQLITE_CONSTRAINT_FOREIGNKEY` against a real D1 database
   whose rebuilt table already has dependent rows elsewhere. `defer_foreign_keys` _is_ honored
   mid-transaction and defers every check to the final commit. See
   `docs/data/DATA_RETENTION.md`'s "Migration-authoring note" for the full empirical finding
   (migrations 0013–0015). Validate any migration of this shape against a **fresh D1**, not just
   raw `sqlite3`: `wrangler d1 execute --local --persist-to <scratch-dir> --file <migration>`.

## Local workflow

```bash
pnpm db:migrate        # wrangler d1 migrations apply --local
pnpm db:seed            # applies packages/database/seed/seed.sql to the local DB
pnpm db:validate        # static drift check between migrations/ and schema/
```

## Rollback / recovery

D1 has no native "undo migration" command. Recovery options, in order of preference:

1. **Forward-fix**: write a new migration that reverses the problematic change (e.g. drop a
   column added in error). This is the default and only recommended path.
2. **Local/preview only**: delete the local sqlite file under `.wrangler/` and re-run
   `db:migrate`+`db:seed` from scratch — never available for production D1.
3. **Production incident**: see `docs/operations/BACKUP_AND_RECOVERY.md` once a production
   database exists; there is no production database in Part 1.
