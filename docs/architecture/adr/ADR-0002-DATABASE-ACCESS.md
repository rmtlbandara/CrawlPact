# ADR-0002: Database Access Strategy

**Status:** Accepted
**Date:** 2026-07-22

## Context

CrawlPact uses Cloudflare D1 (SQLite) as its only datastore (SRS §31, §32). The schema is
large (35+ tables across identity, billing, domains/scans, registry, notifications, and
administration). Requirements include foreign keys, unique constraints, indexes, explicit
timestamps, strict TypeScript, migration ordering, and a documented rollback approach — with
no direct production schema edits.

Cloudflare's own D1 documentation describes a `wrangler d1 migrations` workflow: numbered
`.sql` files in a `migrations/` directory, tracked in a `d1_migrations` table, applied with
`wrangler d1 migrations apply` against local or remote targets. Drizzle ORM ships an official
D1 driver (`drizzle-orm/d1`) and is Cloudflare's own commonly documented recommendation for
typed D1 access.

Two migration-authoring approaches were available: (a) let `drizzle-kit` generate SQL
migrations from a TypeScript schema, or (b) hand-author SQL migrations and use Drizzle purely
as a typed query builder over the resulting tables.

## Decision

- **Migrations are hand-authored SQL**, stored in `packages/database/migrations/NNNN_name.sql`
  and applied exclusively via `wrangler d1 migrations apply` (local and remote). SQL is the
  single source of truth for schema shape. This avoids drizzle-kit/D1 generator drift, keeps
  every DDL change reviewable as plain SQL, and matches Cloudflare's own documented workflow
  exactly — no bespoke migration runner is required.
- **Drizzle ORM (`drizzle-orm/d1`) is used only as a typed query builder**, not as the
  migration source of truth. `packages/database/src/schema.ts` declares Drizzle table
  definitions that must mirror the SQL migrations. A `db:validate` script (Part 1) parses the
  migrations and fails CI if a table Drizzle expects is missing from applied SQL, catching
  drift between the two representations.
- Every table includes `created_at` (and `updated_at` where the row is mutable after
  creation), a stable primary key (`TEXT` UUID or `INTEGER AUTOINCREMENT` per table's access
  pattern), and a `deleted_at` soft-delete column where the SRS implies recoverable deletion
  (users, domains, domain_groups, shared_reports). Immutable append-only tables (audit logs,
  security events, product events, registry/ruleset versions) have no soft delete — they are
  never edited or removed by application code.
- Foreign keys are declared with `PRAGMA foreign_keys = ON` enabled at the D1 binding level and
  `ON DELETE` behaviour chosen per relationship (`CASCADE` for strictly-owned child rows like
  `passkey_credentials` → `users`; `RESTRICT`/`SET NULL` where historical integrity matters,
  e.g. `scans` keep their `registry_version_id` even if a domain is later deleted).
- Local development and CI use `wrangler d1 migrations apply --local`, seeded by
  `packages/database/seed/*.sql` (idempotent, non-production data only — see
  `docs/data/DATA_MODEL.md` and the seed script itself for exact fixtures).

## Alternatives Considered

1. **drizzle-kit-generated migrations** — rejected for Part 1: introduces a second
   schema-authoring surface (TS) whose generated SQL must still be reviewed, without removing
   the need to hand-verify D1-specific SQLite dialect quirks (e.g. limited `ALTER TABLE`
   support). Hand-authoring once and keeping Drizzle in sync is more transparent for a solo
   founder and for agent-driven review.
2. **Raw `env.DB.prepare()` everywhere, no ORM** — rejected: with 35+ tables, losing
   compile-time column/type checking on every query is a correctness risk strict TypeScript is
   meant to prevent. Drizzle's D1 driver has effectively no runtime cost beyond D1's own
   `prepare`/`bind` calls, so this is a low-cost, high-value addition.
3. **Prisma** — rejected: Prisma's engine model is not a natural fit for Cloudflare Workers'
   isolate runtime; Drizzle is purpose-built for edge runtimes including D1.

## Consequences

- Every schema change requires two edits kept in sync: the new `.sql` migration and the
  corresponding `schema.ts` update. `db:validate` exists specifically to catch when these
  diverge.
- Rollback: D1 migrations are forward-only. A faulty migration is corrected by writing a new
  forward migration, never by editing or deleting an applied one (see
  `docs/data/MIGRATION_POLICY.md`).
