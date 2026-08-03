# Data Model

Authoritative schema: `packages/database/migrations/*.sql` (SQL is the source of truth,
ADR-0002). `packages/database/src/schema/*.ts` is a typed Drizzle mirror, checked for drift by
`pnpm db:validate`.

## Migration groups

| File                                                  | Tables                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0001_plans.sql`                                      | `plans`                                                                                                                                                                                                                                                                                                                                  |
| `0002_identity.sql`                                   | `users`, `passkey_credentials`, `recovery_codes`, `sessions`, `admin_roles`, `admin_role_assignments`                                                                                                                                                                                                                                    |
| `0003_billing.sql`                                    | `billing_customers`, `subscriptions`, `transactions`, `webhook_events`, `temporary_entitlements`                                                                                                                                                                                                                                         |
| `0004_registry.sql`                                   | `crawler_operators`, `crawlers`, `registry_versions`, `registry_version_entries`, `ruleset_versions`                                                                                                                                                                                                                                     |
| `0005_domains_scans.sql`                              | `domain_groups`, `domains`, `scans`, `scan_resources`, `scan_crawler_results`, `findings`, `scan_diffs`                                                                                                                                                                                                                                  |
| `0006_notifications_sharing.sql`                      | `notifications`, `feed_tokens`, `shared_reports`, `system_notices`                                                                                                                                                                                                                                                                       |
| `0007_admin_security.sql`                             | `admin_audit_logs`, `blocked_targets`, `security_events`, `scheduled_job_runs`, `runtime_configuration`, `internal_user_notes`, `product_events`                                                                                                                                                                                         |
| `0008_preferences.sql`                                | `user_preferences`, `saved_filters`, `table_preferences`                                                                                                                                                                                                                                                                                 |
| `0009_registry_active_pointer.sql`                    | Adds active-release pointer columns to `registry_versions`/`ruleset_versions` (no new tables)                                                                                                                                                                                                                                            |
| `0010_scan_recommendations.sql`                       | Adds `scans.recommended_additions` (no new tables)                                                                                                                                                                                                                                                                                       |
| `0011_security_event_resolution.sql`                  | Adds resolution columns to `security_events` (no new tables)                                                                                                                                                                                                                                                                             |
| `0012_performance_indexes.sql`                        | Adds indexes only (`scans.started_at`, `transactions.occurred_at`, `webhook_events.received_at`, `admin_audit_logs.target`, `security_events.resolved_at`) — no new tables/columns                                                                                                                                                       |
| `0013_billing_customer_survives_account_deletion.sql` | Changes `billing_customers.user_id` FK behavior (`CASCADE` → `SET NULL`, nullable) — no new tables                                                                                                                                                                                                                                       |
| `0014_product_events_survive_account_deletion.sql`    | Same FK-survival fix applied to `product_events.user_id` — no new tables                                                                                                                                                                                                                                                                 |
| `0015_actor_references_survive_account_deletion.sql`  | Same FK-survival fix applied to 12 more actor-reference columns across `crawlers`, `registry_versions`, `ruleset_versions`, `admin_role_assignments`, `temporary_entitlements`, `scans`, `system_notices`, `security_events` (×2), `admin_audit_logs`, `blocked_targets`, `runtime_configuration`, `internal_user_notes` — no new tables |
| `0016_scan_score_breakdown.sql`                       | Adds `scans.score_breakdown` (no new tables)                                                                                                                                                                                                                                                                                             |

Ordering matters: plans before users (FK), registry before scans (FK), users before
domains/billing (FK). See each file's header comment for the specific dependency.

## Conventions

- Timestamps: `TEXT` in ISO 8601 (`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` default), sortable as
  strings, consistent with SQLite's lack of a native datetime type.
- Booleans: `INTEGER` with a `CHECK (col IN (0,1))` constraint; Drizzle maps these with
  `{ mode: "boolean" }` for a real `boolean` TS type.
- Soft deletion (`deleted_at`): present on `users`, `domain_groups`, `domains`,
  `shared_reports` — entities a user can recover. Append-only/log tables
  (`admin_audit_logs`, `security_events`, `product_events`, `scheduled_job_runs`,
  `registry_version_entries`) have no soft delete; they are never mutated after insert.
- Every table has a stable primary key: `TEXT` UUID for entities referenced across the app,
  `INTEGER AUTOINCREMENT` for append-only logs where natural insertion order is the only
  ordering that matters.

## Entity relationship notes

- A `scan` may have `domain_id = NULL` (anonymous audit) or reference a saved `domain`.
- `scan_crawler_results` and `findings` both cite the exact `registry_version_id` /
  `ruleset_version_id` used, so historical results remain reproducible even after the registry
  or ruleset changes (SRS FR-REG-007, FR-REC-009).
- `scan_diffs.diff_type` distinguishes `website_drift` from `registry_drift` — this is a
  first-class column, not a derived value, because the SRS treats the distinction as
  launch-blocking (§25, §36.18).
- **Known gap** (found 2026-07-26, `docs/data/D1_STORAGE_CAPACITY_AUDIT.md`): `scan_diffs.previous_scan_id`
  and `current_scan_id` reference `scans(id)` with no `ON DELETE` clause (SQLite defaults to
  `NO ACTION`), unlike `domain_id`'s `ON DELETE CASCADE` on the same table — the same class of bug
  already fixed for 14 other columns in migrations 0013–0015. Not yet fixed; tracked in
  `docs/status/KNOWN_RISKS.md`.

Almost all application data lives in D1; R2 was adopted 2026-07-30 for agency-branding logo
uploads only (`AGENCY_LOGOS` binding) — see `docs/data/D1_R2_DATA_PLACEMENT_POLICY.md` (corrects
this document's prior "no R2/object storage is used" claim, Phase 1, 2026-08-03)
(`docs/data/D1_R2_DATA_PLACEMENT_POLICY.md`, 2026-07-26).

See `docs/data/DATA_RETENTION.md` for retention periods and `docs/data/MIGRATION_POLICY.md` for
how schema changes are made safely.
