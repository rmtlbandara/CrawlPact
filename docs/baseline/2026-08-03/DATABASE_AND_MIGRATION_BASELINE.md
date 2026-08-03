# Database and Migration Baseline — 2026-08-03

Phase 0 baseline. Read-only static inspection of `packages/database/migrations/*.sql` (hand-authored
SQL, source of truth per ADR-0002), `packages/database/src/schema/*.ts` (Drizzle mirror),
`packages/database/seed/{reference-data.sql,seed.sql}`, and `scripts/validate-db-schema.mjs`,
cross-checked against a live, read-only production D1 query (see
`PRODUCTION_INFRASTRUCTURE_INVENTORY.md` §2). No migration was applied; no database was modified.

## 1. Local vs. production migration state — no drift

**Result: identical.** Local `packages/database/migrations/` has exactly 18 files (`0001_plans.sql`
through `0018_incidents.sql`), and a live query against production `crawlpact-db`'s `d1_migrations`
table returns the identical 18-row list in the identical order. Preview (`crawlpact-db-preview`)
matches too. **Local and production are fully in sync — zero migration drift.**

This is more recent than `docs/status/IMPLEMENTATION_STATUS.md`'s 2026-07-26 note of "16/16
migrations, 38 tables" — two additional migrations (`0017`, `0018`) have been applied since that
document was last updated, adding 2 tables (38→40 net). Logged in `DOCUMENTATION_CONFLICTS.md` as a
stale-documentation finding, not a schema defect.

### 1.1 Full migration list, in order

| #    | File                                                   | Adds/changes                                                                                                                                     |
| ---- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0001 | `0001_plans.sql`                                       | `plans`                                                                                                                                          |
| 0002 | `0002_identity.sql`                                    | `users`, `passkey_credentials`, `recovery_codes`, `sessions`, `admin_roles`, `admin_role_assignments`                                            |
| 0003 | `0003_billing.sql`                                     | `billing_customers`, `subscriptions`, `transactions`, `webhook_events`, `temporary_entitlements`                                                 |
| 0004 | `0004_registry.sql`                                    | `crawler_operators`, `crawlers`, `registry_versions`, `registry_version_entries`, `ruleset_versions`                                             |
| 0005 | `0005_domains_scans.sql`                               | `domain_groups`, `domains`, `scans`, `scan_resources`, `scan_crawler_results`, `findings`, `scan_diffs`                                          |
| 0006 | `0006_notifications_sharing.sql`                       | `notifications`, `feed_tokens`, `shared_reports`, `system_notices`                                                                               |
| 0007 | `0007_admin_security.sql`                              | `admin_audit_logs`, `blocked_targets`, `security_events`, `scheduled_job_runs`, `runtime_configuration`, `internal_user_notes`, `product_events` |
| 0008 | `0008_preferences.sql`                                 | `user_preferences`, `saved_filters`, `table_preferences`                                                                                         |
| 0009 | `0009_registry_active_pointer.sql`                     | ALTER: `is_active` + partial unique indexes on registry/ruleset versions                                                                         |
| 0010 | `0010_scan_recommendations.sql`                        | ALTER: `scans.recommended_additions`                                                                                                             |
| 0011 | `0011_security_event_resolution.sql`                   | ALTER: `security_events` resolution fields                                                                                                       |
| 0012 | `0012_performance_indexes.sql`                         | 5 new indexes, no schema change                                                                                                                  |
| 0013 | `0013_billing_customer_survives_account_deletion.sql`  | Rebuild: `billing_customers.user_id` → `SET NULL`                                                                                                |
| 0014 | `0014_product_events_survive_account_deletion.sql`     | Rebuild: `product_events.user_id` → `SET NULL`                                                                                                   |
| 0015 | `0015_actor_references_survive_account_deletion.sql`   | Rebuild of 12 tables: remaining actor-reference columns → `SET NULL`                                                                             |
| 0016 | `0016_scan_score_breakdown.sql`                        | ALTER: `scans.score_breakdown`                                                                                                                   |
| 0017 | `0017_domains_unique_origin_excludes_soft_deleted.sql` | Rebuild: `domains` unique constraint → partial index excluding soft-deleted rows                                                                 |
| 0018 | `0018_incidents.sql`                                   | New: `incidents`, `incident_updates` (latest migration)                                                                                          |

No duplicate migration numbers; strictly sequential, no gaps.

## 2. Tables (40 total per local schema validator; 39 per live production `sqlite_master` query — see §7)

| Table                                                                                                                                                      | Classification         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `plans`                                                                                                                                                    | registry/reference     |
| `users`, `passkey_credentials`, `recovery_codes`, `sessions`                                                                                               | identity               |
| `admin_roles`, `admin_role_assignments`                                                                                                                    | admin                  |
| `billing_customers`, `subscriptions`, `transactions` (retention-sensitive), `webhook_events`, `temporary_entitlements`                                     | billing                |
| `crawler_operators`, `crawlers`, `registry_versions`, `registry_version_entries`, `ruleset_versions`                                                       | registry               |
| `domain_groups`, `domains` (retention-sensitive, soft-delete)                                                                                              | user-owned registry    |
| `scans` (high-growth), `scan_resources` (high-growth, PII/content-risk), `scan_crawler_results`, `findings`, `scan_diffs` (retention-sensitive)            | audit/scan             |
| `notifications` (retention-sensitive), `feed_tokens`, `shared_reports`, `system_notices`                                                                   | notification           |
| `admin_audit_logs`, `blocked_targets`, `security_events` (retention-sensitive), `scheduled_job_runs`, `runtime_configuration`, `internal_user_notes` (PII) | admin/security         |
| `product_events` (retention-sensitive)                                                                                                                     | product-event          |
| `user_preferences`, `saved_filters`, `table_preferences`                                                                                                   | user-owned registry    |
| `incidents`, `incident_updates`                                                                                                                            | incident (new in 0018) |

## 3. Foreign keys and `ON DELETE` behavior

**Fixed (`SET NULL`, actor references)**: `billing_customers.user_id`, `product_events.user_id`,
`crawlers.approved_by_user_id`, `registry_versions.published_by_user_id`,
`ruleset_versions.published_by_user_id`, `admin_role_assignments.assigned_by_user_id`,
`temporary_entitlements.granted_by_user_id`, `scans.triggered_by_user_id`,
`system_notices.created_by_user_id`, `security_events.user_id`,
`security_events.resolved_by_user_id`, `admin_audit_logs.administrator_user_id`,
`blocked_targets.blocked_by_user_id`, `runtime_configuration.updated_by_user_id`,
`internal_user_notes.author_user_id`, `incidents.created_by_user_id`,
`incident_updates.created_by_user_id`.

**`CASCADE` (structural/ownership)**: `passkey_credentials.user_id`, `recovery_codes.user_id`,
`sessions.user_id`, `admin_role_assignments.user_id`, `subscriptions.billing_customer_id`,
`transactions.billing_customer_id`, `temporary_entitlements.user_id`,
`domain_groups.owner_user_id`, `domains.owner_user_id`, `scans.domain_id`,
`scan_resources.scan_id`, `scan_crawler_results.scan_id`, `findings.scan_id`,
`scan_diffs.domain_id`, `notifications.{user_id,domain_id}`, `feed_tokens.user_id`,
`shared_reports.{scan_id,owner_user_id}`, `user_preferences.user_id`, `saved_filters.user_id`,
`table_preferences.user_id`, `registry_version_entries.registry_version_id`,
`internal_user_notes.user_id` (subject, deliberately CASCADE), `incident_updates.incident_id`.

**Still open — no `ON DELETE` clause (defaults `NO ACTION`)**: `scan_diffs.previous_scan_id`,
`scan_diffs.current_scan_id` (both → `scans(id)`, `0005_domains_scans.sql:130-131`). Already
disclosed in `docs/status/KNOWN_RISKS.md` as the same bug class already fixed for 14 other
columns; **confirmed still unfixed** as of this HEAD. Not fixed in this docs-only phase; carried
forward to `BASELINE_RISKS_AND_UNKNOWNS.md`.

Additional FKs with no `ON DELETE` clause, lower risk (reference/catalog parents unlikely to be
deleted while referenced — not previously flagged, noted here for completeness):
`crawlers.operator_id`, `crawlers.replacement_crawler_id`, `subscriptions.plan_id`,
`transactions.subscription_id`, `webhook_events.related_billing_customer_id`/
`related_subscription_id`, `users.plan_id`, `admin_role_assignments.role_id`,
`temporary_entitlements.granted_plan_id`, `scans.registry_version_id`/`ruleset_version_id`,
`scan_crawler_results.crawler_id`/`source_resource_id`, `findings.affected_crawler_id`,
`findings.ruleset_version_id` (NOT NULL).

## 4. Indexes

Standard indexes on essentially every FK and commonly-filtered/sorted column. Two **partial
unique indexes** enforce invariants at the database level: `idx_registry_versions_single_active` /
`idx_ruleset_versions_single_active` (at most one active release per table, migration 0009), and
`idx_domains_owner_origin_live` (unique per-owner domain origin excluding soft-deleted rows,
migration 0017, replacing a table-level `UNIQUE` that incorrectly blocked re-saving a
soft-deleted domain).

## 5. Destructive migrations

None destructive to data by intent. Migrations 0013/0014/0015/0017 each perform SQLite's
documented table-rebuild pattern (`CREATE x_new` → `INSERT...SELECT *` → `DROP x` →
`RENAME x_new TO x`) to change FK/constraint behavior `ALTER TABLE` can't touch directly, protected
by `PRAGMA defer_foreign_keys=ON` (not `foreign_keys=OFF`, documented as a no-op inside a D1
migration file — see `docs/data/MIGRATION_POLICY.md`). No migration drops data without an
equivalent rebuild preserving it.

## 6. Schema validation tooling

`scripts/validate-db-schema.mjs` — a regex-based static parser (not a real SQL parser) folding
`ALTER TABLE ADD COLUMN` and rebuild-rename patterns, cross-checking table/column names against
Drizzle's `schema/*.ts`. **Actually executed this session** (`pnpm db:validate`, part of the
quality gate — see `TEST_AND_CI_EVIDENCE.md`): **40 tables verified consistent, zero problems.**
It checks names only, not `ON DELETE` behavior — a Drizzle `.references()` call with no
`onDelete` option can coexist with real `ON DELETE SET NULL` in the actual SQL (SQL migrations are
the source of truth per ADR-0002); this is by design but is a place a future refactor could form
false confidence from the TypeScript schema alone.

## 7. Table-count discrepancy (40 local vs. 39 live production) — not fixed, logged

`pnpm db:validate` (local, static) reports 40 tables. A live `sqlite_master` query against
production `crawlpact-db` (this session, see `PRODUCTION_INFRASTRUCTURE_INVENTORY.md` §2.2)
enumerates 39 real tables, excluding `d1_migrations`/`sqlite_*`. Both counts are internally
consistent with what they each measure; the discrepancy's root cause was not investigated further
in this inspection-only phase (Phase 0 rules forbid fixing discoveries). Logged in
`DOCUMENTATION_CONFLICTS.md` and `BASELINE_RISKS_AND_UNKNOWNS.md`.

## 8. Retention-policy-relevant fields

- **Unused dedup field**: `scan_resources.resource_hash` exists (`0005_domains_scans.sql:80`) but
  no code path populates or reads it — confirmed still unused, matching the already-known risk.
- **High-growth**: `scans` (named explicitly in migration 0012's own comment as the single
  largest/fastest-growing table), `scan_resources.snapshot_text` under `html_meta` (full
  truncated HTML body, the largest documented D1 storage growth driver).
- **No purge job** (append-only/indefinite growth): `product_events`, `security_events`,
  `notifications`, `transactions`, `webhook_events`.
- **PII-adjacent**: `internal_user_notes.note` (free text about a customer — deliberately kept
  `CASCADE` with the subject, distinct from the actor-reference `SET NULL` pattern),
  `sessions.ip_hash`, `security_events.ip_hash` (both hashed, never raw IP).

## 9. Seed data

- `packages/database/seed/reference-data.sql` (production-safe, idempotent `INSERT OR IGNORE`
  keyed on real primary keys) seeds `plans`, `admin_roles`, `runtime_configuration`, the full
  crawler registry, and the one active `registry_versions`/`ruleset_versions` release.
- `packages/database/seed/seed.sql` (local-dev only) adds one Super Admin fixture and two
  illustrative **inactive** historical registry-version snapshots via fixed exclusion lists.
- **New finding, not previously documented**: `reference-data.sql`'s `registry_version_entries`
  insert for the active release uses a dynamic `SELECT ... FROM crawlers WHERE operator_id IN
(...)` rather than a fixed crawler-ID list. Since this file is designed to be safely re-run
  against a database that already has data, and later crawlers were added to the same operator
  group after the release was first published, re-running it against a database with that release
  already active risks silently inserting new `registry_version_entries` rows into an
  already-published "immutable" release — contradicting the documented immutability guarantee.
  **Not confirmed against a live database this session** (no write/re-run was performed); logged
  as a new risk in `BASELINE_RISKS_AND_UNKNOWNS.md`, routed to Phase 15.

## 10. Verification limitations

- FK `ON DELETE` behavior for the "lower risk" list in §3 was read from migration SQL only, not
  independently exercised against test data.
- The 40-vs-39 table-count discrepancy's root cause is unresolved (see §7).
