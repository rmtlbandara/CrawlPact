# Phase 09 — Agency Workspace and Portfolio Workflows: Completion Report

## Executive summary

Before this phase, an agency or multi-site operator had no portfolio-level view of their saved
domains: no explainable summary of what needed attention, no account-wide feed of recent
policy/registry changes, no way to import domains from a CSV file (only a JSON list of raw
strings, the client splitting the text itself), and no way to delete a domain group without first
manually emptying it. Domain groups, CSV export, and Agency-branded shared reports already existed
as shipped, tested, entitlement-gated features (confirmed by direct code inspection before writing
a line of new code — see `docs/product/PHASE_09_AGENCY_WORKSPACE_BASELINE.md`) and were extended,
not rebuilt.

This phase adds: an authenticated agency workspace (`/app/workspace`) with a 9-section information
architecture; an explainable portfolio summary and deterministic attention queue built from Phase
8's `domain_change_events`; an account-wide, cursor-paginated portfolio change feed; safe non-empty
group deletion (domains move to Ungrouped, history preserved); a server-side-paginated portfolio
table; a genuine CSV _file_ batch-import workflow (hand-written RFC 4180 parser, preview/confirm,
idempotent, capacity-safe); an extended CSV export (group/selection scope, more columns); bounded
bulk actions (group assignment, monitoring state); a persistent Agency-branding profile; and wiring
for the previously-unused `saved_filters`/`table_preferences` schema into real saved views. It also
closes a pre-flagged risk (RISK-010, R2 logo orphans) via the daily retention cron, exactly per that
risk's own stated closure criterion.

Team roles, a client portal, bulk rescan, a multi-domain portfolio-report product, and cross-domain
comparison were all evaluated against the SRS and explicitly **not** implemented — see the six
`PHASE_09_*_DECISION.md` documents this phase produced.

## Starting state

- **Starting commit**: `5ac3e1d` (main, post-Phase-8-deployment-record merge, PR #92)
- **Production Worker before this phase**: `629c546c-ba30-4147-af6f-b750e5c051b2`
- **Migration state before this phase**: `0001`–`0028` applied (28/28), confirmed via
  `docs/status/CURRENT_STATE.md`
- **Prior-phase reports read**: Phase 6 (`PHASE_06_PRICING_PADDLE_CHECKOUT_COMPLETION_REPORT.md`),
  Phase 8 (`PHASE_08_SAVED_DOMAIN_CHANGE_TIMELINE_COMPLETION_REPORT.md`), Phase 11
  (`PHASE_11_DATABASE_STORAGE_PERFORMANCE_COMPLETION_REPORT.md`)
- **Existing groups**: full CRUD (`domain_groups` table, migration 0005), Pro/Agency-gated,
  flat single-owner, no non-empty-delete support before this phase
- **Existing import/export**: JSON batch-import (paste-list, not a file), full-fidelity CSV export
  with formula-injection protection already present
- **Existing branding**: per-share only (no persistent profile), R2-backed logo pipeline already
  shipped and tested
- **Existing query/performance baseline**: Phase 11's `MONITORING_CAPACITY_PLAN.md` and
  `SCAN_CAPACITY_BUDGET.md` — informed the "no synchronous batch scanning" import design

## Workspace model

- **Ownership model**: single-user account ownership (`owner_user_id` FK on every domain-owning
  table) — unchanged by this phase.
- **Workspace decision**: `PHASE_09_WORKSPACE_MODEL_DECISION.md` — no new tenancy entity
  introduced; "workspace" means "your account's portfolio view," not a new access-control
  boundary.
- **Team-membership decision**: `PHASE_09_TEAM_AND_MEMBERSHIP_DECISION.md` — SRS §38 explicitly
  defers team accounts to post-MVP future scope; zero of the ten required preconditions are met;
  not implemented. No "Invite team"/"Members" UI exists anywhere.
- **Client-entity decision**: `PHASE_09_CLIENT_ENTITY_DECISION.md` — no `clients` table added;
  `domain_groups` (extended with an optional `description` column) serves as the client-
  organisation primitive, matching the SRS's own "client groups" = Agency-tier vocabulary for the
  same underlying concept.

## Information architecture

Final workspace sections (`docs/product/AGENCY_WORKSPACE_INFORMATION_ARCHITECTURE.md`):

1. Workspace header (plan, usage, monitoring coverage, primary actions)
2. Portfolio summary (explainable counts)
3. Attention queue
4. Recent portfolio changes
5. Domain groups (compact list, links to `/app/groups`)
6. Managed domains (links to the new `/app/workspace/domains` full table)
7. Import and export actions
8. Agency report branding
9. Plan usage and limits

## Portfolio summary

Metrics, all derived from one shared, bounded, batched fetch (`getPortfolioSnapshot`,
`apps/web/src/lib/portfolio.ts`) — never a full-history scan:

`totalDomains`, `monitoringActive`, `monitoringDisabled`, `monitoringPaused`,
`requiringAttention`, `incompleteEvidence`, `failedLatestScan`, `meaningfulChangesInPeriod`,
`websitePolicyChangesInPeriod`, `registryDrivenChangesInPeriod`, `baselinePending`.

No opaque score. Every count links to a filtered `/app/workspace/domains` view computed from the
same underlying data. Data freshness shown as a literal timestamp, never "real-time." Full model:
`docs/product/PORTFOLIO_SUMMARY_MODEL.md`.

**Attention logic** (deterministic, `docs/product/PORTFOLIO_ATTENTION_MODEL.md`): high-attention
finding, registry/website-policy change requiring review, mixed conflict, monitoring paused after
reaching the existing `FAILURE_PAUSE_THRESHOLD`, latest scan incomplete/failed, baseline pending.

**Change feed**: cursor-paginated (keyset, not offset) directly against
`domain_change_events`, since — unlike the ≤100-domain-bounded summary/attention queries — this
data grows unboundedly over an account's lifetime. Filterable by group, change origin, attention
level, date. Strictly account-isolated (every query joins through `domains.owner_user_id`).

## Groups

- **Model**: unchanged flat single-owner `domain_groups`, extended with `description` (optional,
  500-char cap, never exported by default).
- **Deletion**: `deleteGroupWithReassignment` — a non-empty group can now be deleted; its domains
  move to a chosen destination group or Ungrouped; domain history/monitoring/scans are untouched.
  The pre-existing `deleteGroupIfEmpty` behaviour (block on non-empty) is fully replaced — an
  existing integration test asserting the old 409 behaviour was updated to assert the new,
  better-specified 200 + `movedCount` behaviour.
- **Entitlements**: unchanged — Pro and Agency only, enforced server-side via `getPlan()`.
- **Privacy**: a group proves no client identity, ownership, or authorisation — restated in the
  group-creation UI copy.
- **New**: group-overview page (`/app/groups/[groupId]`) with the same explainable-count model,
  scoped to one group.

## Import

- **CSV schema**: required `domain`; optional `display_name`, `group`, `notes`, `monitoring`.
  Unknown columns accepted and reported per-row as `unsupported_field`, never interpreted.
- **Validation**: 11 distinct per-row outcomes (`created`, `duplicate_in_file`, `already_saved`,
  `invalid_domain`, `private_target`, `group_not_found`, `monitoring_unavailable`,
  `limit_exceeded`, `batch_limit_exceeded`, `field_too_long`, `unsupported_field`), computed by
  `buildImportPlan` (`apps/web/src/lib/portfolio-import.ts`), shared identically by preview and
  confirm.
- **Preview**: `POST /api/workspace/import/preview` — validates only, writes nothing.
- **Execution architecture**: a load-bearing finding changed the shape of this work —
  no domain-creation path in CrawlPact (not single-add, not the pre-existing JSON batch-import,
  not this new CSV import) ever triggers a scan synchronously; the existing monitoring sweep picks
  up every newly created domain on its next tick (NULL `next_scan_at` sorts first). Import
  therefore only needs to create domain rows safely — pure D1 writes, no outbound network call —
  which is safe to do synchronously for up to the Agency ceiling (100 rows) in one request. No
  queue or background-job system was built; see `docs/product/CSV_IMPORT_WORKFLOW.md`'s "why no
  background job" section for the full reasoning.
- **Idempotency**: `portfolio_import_jobs.idempotency_key`, unique per owner — a retried confirm
  submission returns the stored result, never re-creates domains. Proven by a real D1 integration
  test.
- **Retention**: `docs/data/PHASE_09_IMPORT_AND_BULK_JOB_RETENTION.md` — 90-day job/row retention,
  raw CSV never persisted (exists only in request memory).
- **Security**: hand-written, unit-tested RFC 4180 parser (`apps/web/src/lib/csv.ts`'s new
  `parseCsv`) — bounded rows/columns/field-length, no formula execution, UTF-8-validated at the
  route. See "Real bugs found" below for two defects this testing surfaced and fixed.

## Export

- **Scope**: existing full-account export, plus new `groupId`/`domainIds`/`includeNotes` query
  parameters — every scope re-validated against ownership server-side, never trusted from the
  query string.
- **Fields**: existing 8 columns + Group, Monitoring frequency, Latest meaningful change, Change
  origin, Unresolved attention count. Notes excluded unless `includeNotes=1` is explicitly passed.
- **Sanitisation**: unchanged `escapeCsvField`, reused identically for import and export.
- **Authorisation**: `plan.csvExportEnabled`, unchanged; rate-limited (30/hour); audit event
  recorded.
- **Performance**: bounded by the same ≤100-domain ceiling every export always had.

## Bulk actions

- **Supported**: assign group, move group, remove from group, enable/disable/pause/resume
  monitoring, export selection (delegates to the export scope above).
- **Deferred** (each requires separate authorisation, per `docs/product/BULK_ACTION_MODEL.md`):
  bulk rescan, bulk report-share creation, bulk deletion, bulk note replacement, bulk
  policy-objective change.
- **Capacity controls**: max 100 domain IDs/request; plan re-read fresh at execution time (not
  selection time); every domain ID re-validated against ownership.
- **Per-domain results**: `succeeded | skipped | failed` with a reason category for every domain,
  never a single aggregate pass/fail.

## Agency branding

- **Profile**: new `agency_brand_profiles` table (one row/user) — `agencyName`, `logoUrl` only;
  `clientName`/`introText` stay per-share (they describe one specific report, not an account-wide
  default).
- **R2**: reuses the existing upload/serving/magic-byte-sniffing pipeline unchanged; the profile
  simply stores the resulting path.
- **Report rendering**: unchanged — `AuditReportView` already renders CrawlPact's methodology,
  evidence, limitations, and registry version unconditionally regardless of branding (verified by
  reading the component, not assumed).
- **Attribution**: unchanged "Prepared for {clientName}" / CrawlPact-attribution copy.
- **Revocation**: unchanged per-share revoke flow.
- **Cleanup**: `findAndCleanupOrphanedLogos` updated to also treat `agency_brand_profiles.logo_url`
  as a valid reference (a profile logo can now exist before any share references it) — a one-line
  addition, not a new sweep.

## Database

**Migration**: `0029_agency_workspace_portfolio.sql` (additive only):

- `domain_groups.description` (nullable column add)
- `agency_brand_profiles` (new table)
- `portfolio_import_jobs`, `portfolio_import_rows` (new tables)
- `bulk_action_jobs` (new table)
- `idx_domains_owner_group`, `idx_domains_owner_monitoring` (new indexes)
- 3 new unique indexes (idempotency keys) + 2 new lookup indexes on the job tables

`pnpm run db:validate`: **47 tables verified consistent** (up from 43 at the end of Phase 8).

**Query architecture**: `docs/data/PHASE_09_PORTFOLIO_QUERY_AND_INDEX_AUDIT.md` — every new
high-value query listed with its plan filter and bound; no N+1 introduced by this phase's new
code (a pre-existing, separately-tracked N+1 — RISK-034 — is explicitly not touched, per the
baseline's own scope discipline).

## Security

Full checklist and mitigations: `docs/security/PHASE_09_AGENCY_WORKSPACE_THREAT_REVIEW.md`.
Verified by real tests, not assumed:

- **Account isolation**: cross-account tests for portfolio summary/attention/changes/domains
  table, group access, import-job access, export, bulk actions, branding profile — all pass (real
  D1 integration tests + one browser-level e2e journey).
- **CSV injection**: formula-like values (`=cmd|...`) proven to round-trip as literal text through
  both import and export, in both an integration test and a real-browser e2e test.
- **IDOR**: cross-account domain IDs in bulk actions are reported `skipped`, never silently
  accepted; cross-account group IDs in import are rejected with `VALIDATION_FAILED`.
- **Private caching**: every new route inherits the existing global deny-by-default middleware
  (`private, no-store` + `X-Robots-Tag: noindex`) with zero new code required — confirmed this is
  the actual mechanism (not per-route headers) by reading `apps/web/src/middleware.ts`.

## Accessibility

`pnpm exec playwright test --config=playwright.a11y.config.ts` (chromium): **105/105 passed**,
including 6 new Phase 9 scans (empty workspace, populated portfolio summary, portfolio table with
bulk selection, CSV import screen, groups list, agency branding settings) — zero automatically
detectable WCAG 2.2 AA violations. One real, pre-existing accessibility defect was found and fixed
during this pass (see "Real bugs found" below).

## Analytics

24 new event names added to the existing first-party `product_events` allowlist
(`docs/analytics/PHASE_09_AGENCY_WORKSPACE_EVENT_MODEL.md`) — categorical properties only (plan,
batch-size range, action type, result category); no domain/client/group name, file content, job
ID, or share token is ever sent.

## Performance

No new synchronous external network call is introduced anywhere in this phase's code — CSV import
never triggers a scan; bulk monitoring-enable only flips a flag the existing sweep already reads.
The only new per-request cost is bounded D1 reads/writes. `pnpm run quality`'s production build
step completed cleanly (see Validation below); dedicated before/after Lighthouse numbers were not
separately captured this phase — the new pages are server-rendered with the same minimal-hydration
pattern (`client:load` islands only where interactive) as every existing app page, and add no new
heavy client dependency (no charting library, no new CSV-parsing dependency — the parser is
hand-written specifically to avoid one).

## Validation — commands and results

| Command                                                                           | Result                                                                                                                           |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run format` / `format:check`                                                | Pass                                                                                                                             |
| `pnpm run lint` (`eslint . --max-warnings=0`)                                     | Pass, 0 warnings                                                                                                                 |
| `pnpm run typecheck`                                                              | Pass, 0 errors (433 files)                                                                                                       |
| `pnpm run test:unit`                                                              | **365/365 passed** (36 files)                                                                                                    |
| `pnpm run test:integration`                                                       | **240/240 passed** (33 files)                                                                                                    |
| `pnpm run db:validate`                                                            | 47 tables verified consistent                                                                                                    |
| `pnpm run content:validate`                                                       | Pass                                                                                                                             |
| `pnpm run build`                                                                  | Pass (production build completes)                                                                                                |
| `pnpm run brand:validate`                                                         | Pass (598 files scanned)                                                                                                         |
| `pnpm run trust:validate`                                                         | Pass (444 files scanned)                                                                                                         |
| `pnpm run docs:validate`                                                          | Pass                                                                                                                             |
| `pnpm run secrets:scan`                                                           | Pass — no known secret patterns                                                                                                  |
| `pnpm exec playwright test --project=chromium` (full e2e)                         | **125/126 passed**, 1 flaky (unrelated pre-existing hydration-timing class in `checkout-continuity.spec.ts`, passed on retry)    |
| `pnpm exec playwright test --config=playwright.a11y.config.ts --project=chromium` | **105/105 passed**                                                                                                               |
| Paddle catalog verification                                                       | Not run — zero Paddle/billing files touched this phase (confirmed via `git diff --stat` against `main`), so no drift is possible |

## Real bugs found and fixed during this phase

1. **D1 bound-parameter limit exceeded on multi-row import-row inserts** — a single `INSERT
... VALUES` with more than ~14 rows (7 columns/row) exceeded Cloudflare D1's own ~100
   bound-parameter limit (far lower than plain SQLite's), which would have broken _every_ import
   of more than ~14 rows in production, including a full 100-row Agency import. Found by a real D1
   integration test (`agency-workspace-portfolio.integration.test.ts`), not assumed. Fixed:
   `confirm.ts` now inserts `portfolio_import_rows` in chunks of 10.
2. **Pre-existing accessibility defect**: the group-rename `<Input>` in `GroupsManager.tsx` had no
   accessible label — present before this phase, newly caught by a Phase 9 a11y scan of a
   populated groups list (no prior a11y test exercised that state). Fixed: added
   `aria-label={\`Group name for ${group.name}\`}`.
3. **CSV parser field-length bound too tight for its own purpose**: the parser's structural
   safety bound and the business-level "field too long" validation both used 300 chars, so the
   parser rejected the whole file before the intended per-row classification could ever run.
   Fixed: separated the two — parser bound raised to 4000 (pure safety), business bound stays 300.
4. **Local dev D1 database out of date**: migration `0029` was written and Drizzle-schema-mirrored
   but not yet applied to the local dev D1 file when e2e testing began, causing a real (if
   environmental, not code) 500 on the very first browser-driven group creation — resolved by
   running `pnpm run db:migrate`; noted here since it's a real operational step, not a code fix.

## Production deployment

Not yet performed as of this report's initial version — pending explicit user authorization per
this repository's standing rule. Will be recorded in this section (and a separate deployment-record
PR, matching every prior phase's pattern) once deployed and independently re-verified against
production.

## Deferred work

- **Team roles, invitations, account switching**: `PHASE_09_TEAM_AND_MEMBERSHIP_DECISION.md` —
  route to a future phase only if the SRS is amended to authorise it.
- **Client portal**: not authorised anywhere; no work exists.
- **Bulk rescan**: `PHASE_09_BULK_RESCAN_DECISION.md` — not authorised by SRS or Phase 11 capacity
  evidence.
- **Multi-domain portfolio report**: `PHASE_09_PORTFOLIO_REPORT_DECISION.md` — not authorised;
  CSV export + individual reports + group overview cover the same need today.
- **Cross-domain comparison**: `PHASE_09_CROSS_DOMAIN_COMPARISON_DECISION.md` — not authorised;
  risks misrepresenting differing policy objectives as a ranking.
- **Notification-channel work**: explicitly out of scope, routes to Phase 10.
- **Registry governance / research benchmarking**: routes to Phase 15/16 respectively, per the
  prompt's own instruction — no work here.

## Runtime impact

> Phase 9 adds and improves CrawlPact's authenticated agency workspace, portfolio summaries,
> attention queue, recent-change feed, domain groups, saved views, CSV batch import, CSV export,
> bounded bulk actions, Agency branding, and client-ready private-report workflows. It preserves
> crawler classifications, crawler-registry governance, audit semantics, pricing, plan limits,
> Paddle configuration, monitoring frequencies, notification channels, authentication security,
> retention commitments, and public trust requirements.

## Next phase

Phase 10 (notification-channel work) can proceed against: a stable, tested agency workspace with
real portfolio-wide aggregation patterns (`getPortfolioSnapshot`, the change-feed cursor-pagination
pattern) that any new notification-digest feature can reuse rather than re-deriving; the existing,
unchanged notification infrastructure (`lib/notifications.ts`) this phase deliberately did not
touch; and six explicit decision-gate documents recording exactly which agency-adjacent features
(team roles, bulk rescan, portfolio reports, cross-domain comparison) remain unauthorised, so Phase
10 does not need to re-investigate them from scratch.
