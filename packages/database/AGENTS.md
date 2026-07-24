# AGENTS.md — packages/database

See `docs/architecture/adr/ADR-0002-DATABASE-ACCESS.md` and `docs/data/MIGRATION_POLICY.md` for
full context. Summary of the rules that are easy to violate by accident:

## Migrations

- SQL in `migrations/NNNN_description.sql` is the schema source of truth. Never generate
  migrations from `schema.ts` with a diff/push tool.
- **Forward-only.** Never edit a migration that may already have been applied anywhere (local,
  preview, production). If you need to change something, write a new migration.
- Number sequentially from the highest existing file; don't reuse a number.

## Keeping Drizzle in sync

Every migration change needs a matching edit in `src/schema/*.ts` in the **same** change.
Run `node scripts/validate-db-schema.mjs` (via `pnpm db:validate` from the repo root) before
considering the change finished — it fails loudly on drift.

## Seed data

`seed/seed.sql` is for local development only (`pnpm db:seed`, `--local` target). It must never
contain fabricated production metrics, and any crawler/operator data added here must cite a
real official source (see `docs/registry/SOURCE_VERIFICATION_POLICY.md`) — this is reference
data about real crawlers, not test fixtures that can be invented freely.

## Foreign keys and ordering

Migration files are applied in filename order — a table with a foreign key must be created in
a migration numbered after the table it references (see each file's header comment for why the
current ordering is what it is).

## Rebuilding a table (changing a column's FK behavior, etc.)

SQLite can't `ALTER` a column's FK clause directly, so this requires the documented rebuild
procedure (`CREATE ..._new`, `INSERT ... SELECT`, `DROP`, `RENAME`) — but use
`PRAGMA defer_foreign_keys=ON`, **never** `PRAGMA foreign_keys=OFF`: D1 runs a migration file as
one implicit transaction, and SQLite silently no-ops `foreign_keys` changes mid-transaction, so
`OFF` can pass against a fresh `sqlite3` CLI test and still fail against real D1 the first time
the rebuilt table has real dependent rows elsewhere. See migrations 0013–0015 and
`docs/data/MIGRATION_POLICY.md` for the full finding, and validate any new migration of this
shape against a fresh D1 (`wrangler d1 execute --local --persist-to <scratch-dir> --file ...`),
not just raw `sqlite3`.
