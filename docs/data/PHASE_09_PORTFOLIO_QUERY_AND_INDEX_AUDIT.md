# Phase 09 — Portfolio Query and Index Audit

Follows the Phase 11 query-plan discipline (`docs/performance/` baseline docs): every new
high-value query is inspected with `EXPLAIN QUERY PLAN` against a populated local D1 instance
before being accepted, and every new index is justified by a specific query that needs it —
matching the `db:validate`/`quality` gate's existing standard.

## High-value queries inspected

| Query                      | Used by                                                        | Plan filter                                  | Bound                                   |
| -------------------------- | -------------------------------------------------------------- | -------------------------------------------- | --------------------------------------- |
| Portfolio summary counts   | `/api/workspace/summary`                                       | `owner_user_id`                              | 1 account's domains, ≤100 rows scanned  |
| Attention queue            | `/api/workspace/attention`                                     | `owner_user_id`, keyset cursor               | page size ≤25 (max 100)                 |
| Portfolio change feed      | `/api/workspace/changes`                                       | `owner_user_id`, date-bounded, keyset cursor | page size ≤25 (max 100)                 |
| Group list / group summary | `/api/groups`, `/app/groups/[groupId]`                         | `owner_user_id`                              | ≤ account's own group count             |
| Domain portfolio table     | `/api/workspace/domains`                                       | `owner_user_id`, keyset cursor               | page size ≤25 (max 100)                 |
| Saved view                 | `/api/workspace/saved-views`                                   | `user_id`, `context`                         | ≤20 saved views/user (app-enforced cap) |
| Import-job status          | `/api/workspace/import/jobs/[jobId]`                           | `owner_user_id` + job id                     | 1 row + its child rows                  |
| Shared-report list         | existing `listShares`, unchanged                               | `owner_user_id`, `scan_id`                   | unchanged                               |
| Plan usage                 | `getPlan()` + `countActiveDomains()`, both existing, unchanged | —                                            | —                                       |

## Indexes added (each justified by a specific query above; none redundant with an existing index)

- `idx_domains_owner_group` on `domains(owner_user_id, group_id)` — the portfolio table's
  group-filter and the group-overview page's "domains in this group" query both filter on this
  exact pair; the existing `idx_domains_owner_origin_live` (unique, on
  `owner_user_id, canonical_origin`) does not serve a group-scoped lookup.
- `idx_domains_owner_monitoring` on `domains(owner_user_id, monitoring_state)` — the portfolio
  summary's monitoring-state counts and the portfolio table's monitoring filter both need this;
  no existing index covers `monitoring_state` at all.
- `idx_domain_change_events_domain_observed` — **already exists** (verified in migration 0026,
  `packages/database/migrations/0026_domain_change_events.sql`) and already serves the
  date-bounded, per-domain-set change-feed query via `domain_id IN (owned-set) ORDER BY
observed_at`; no new index needed here, confirmed by reading the existing migration rather than
  assumed.
- `idx_portfolio_import_jobs_owner_status` on `portfolio_import_jobs(owner_user_id, status,
created_at)` — Super Admin's aggregate import-job-count/failure view and the user's own
  "Import history" list both filter this way.
- `idx_bulk_action_jobs_owner_status` on `bulk_action_jobs(owner_user_id, status, created_at)` —
  same rationale, bulk-action history.

No index is added for `saved_filters`/`table_preferences` beyond their existing primary keys
(`user_id` PK on `table_preferences`; `id` PK + implicit `user_id` scan on `saved_filters`, whose
own row count per user is capped small enough — ≤20 — that a dedicated index would not be used by
the query planner over a full-table-scan-of-one-user's-rows at that size).

## No N+1

Every list above uses exactly one batched query per page, following the `getLatestChangeEventPerDomain`
window-function pattern already established in Phase 8 — group names for a page of domains are
joined once, not fetched per row; open-findings counts on the new portfolio table reuse the same
approach `listDomains()` uses today (a known, pre-existing, separately-tracked N+1 — RISK-034 —
which this phase's new code does not touch or extend, and does not introduce a second instance
of).

## Measurement

D1 rows-read and query duration for each query above are captured via the same
`EXPLAIN QUERY PLAN` + row-count method Phase 11's own performance docs used, recorded in the
completion report's Performance section with before/after figures (before = the equivalent
existing unpaginated `/api/domains` call, for the portfolio-table row).
