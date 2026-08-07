# Phase 09 — Agency Workspace Baseline

Recorded before any Phase 9 implementation, per the Phase 9 prompt's "Before editing" and
"Required Existing-State Baseline" steps. This is a factual inventory, not a design document —
design decisions live in the six `PHASE_09_*_DECISION.md` files and the `*_MODEL.md` /
`*_WORKFLOW.md` documents alongside this one.

## Starting state

- **Branch created from**: `main` @ `5ac3e1d` (docs: record production deployment of Phase 8, #92)
- **Production Worker at start**: `629c546c-ba30-4147-af6f-b750e5c051b2` (Phase 8 deployment)
- **Migrations applied in production**: `0001`–`0028` (28/28), per `docs/status/CURRENT_STATE.md`
- **Prior-phase completion reports read**: Phase 6 (billing), Phase 8 (saved-domain/timeline),
  Phase 11 (database/storage/performance), plus `docs/status/CURRENT_STATE.md`,
  `docs/product/CRAWLPACT_FINAL_SRS.md`, `docs/status/REQUIREMENTS_TRACEABILITY.md`,
  `docs/risks/ACTIVE_RISKS.md`.

## Headline finding

**Several capabilities the Phase 9 prompt describes as work to "create" or "implement" already
exist in production as shipped, tested, entitlement-gated features.** This baseline exists
specifically to prevent rebuilding them. Confirmed by direct code/schema inspection, not assumed:

| Capability                                         | Status                            | Evidence                                                                                                                                                                                             |
| -------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain groups (create/rename/delete/assign)        | **Exists**                        | `domain_groups` table (migration 0005), `apps/web/src/lib/groups.ts`, `/api/groups/**`, `GroupsManager.tsx`, `/app/groups`                                                                           |
| Domain-group entitlement (Pro/Agency)              | **Exists**                        | `plans.domain_groups_enabled` = 1 for pro/agency, 0 for free/solo (`reference-data.sql`)                                                                                                             |
| CSV export (formula-injection-safe)                | **Exists**                        | `apps/web/src/lib/csv.ts` (`toCsv`/`escapeCsvField`), `GET /api/domains/export.csv`, gated on `plan.csvExportEnabled`                                                                                |
| Agency branding (name/logo/client name/intro text) | **Exists**                        | `shared_reports.agency_branding` JSON column (migration 0006), `agencyBrandingSchema` (`packages/core/src/api/contracts/sharing.ts`), R2-backed logo pipeline                                        |
| R2 agency-logo storage                             | **Exists, single bucket**         | `AGENCY_LOGOS` binding (`apps/web/wrangler.jsonc`), upload/serve/delete/orphan-sweep all wired (`apps/web/src/lib/agency-logo.ts`, `apps/web/src/lib/r2-orphan-cleanup.ts`)                          |
| Batch import (JSON list, not file)                 | **Exists, partial**               | `POST /api/domains/batch-import` accepts `{targets: string[], groupId?}` — a pre-split text/paste list, **not** a CSV file upload; `batch_import_limit` already seeded per plan (Pro=10, Agency=100) |
| Private/shared reports, revocable, noindex         | **Exists**                        | `shared_reports` table, `ShareReportDialog.tsx`, `/shared/[token].astro`                                                                                                                             |
| Domain notes field                                 | **Exists**                        | `domains.notes` (free text, nullable)                                                                                                                                                                |
| Saved filters / table preferences                  | **Schema exists, zero consumers** | `saved_filters` / `table_preferences` tables (migration 0008) — no API route or UI reads/writes them today                                                                                           |

**Not found anywhere** (confirmed by repo-wide grep, not assumed absent):

- Any workspace, organization, team, membership, invitation, or role-based-access scaffolding
  (schema, API, or UI) beyond the existing single `users.plan_id`-based account/plan model.
- Any Cloudflare Queue binding or usage — `wrangler.jsonc` declares none.
- Any CSV _file_ parsing code or dependency (no `papaparse`/`csv-parse`/`fast-csv` in any
  `package.json`).
- Any client entity separate from `domain_groups`.
- A customer-facing (non-admin) share-revocation route — only the admin route
  (`/api/admin/shared-reports/[shareId]/revoke.ts`) and the library function `revokeShare` (in
  `lib/sharing.ts`, currently unused by any route) exist.
- A bulk/multi-domain rescan action of any kind.
- A multi-domain "portfolio report" artifact distinct from CSV export, group overview, and
  per-domain private reports.
- Cross-domain (different-website) policy comparison — Phase 8's comparison is strictly
  scan-to-scan for one domain.

## Current application shell

- Layout: `apps/web/src/layouts/AppLayout.astro` — props are `{ title, displayName }` only, no
  workspace/account concept.
- Nav (`apps/web/src/components/app/AppNav.astro`, mirrored in `AppMobileNav.tsx`): Overview
  (`/app`), Domains (`/app/domains`), Groups (`/app/groups`), Notifications
  (`/app/notifications`), Billing (`/app/billing`), Account (`/app/account`).
- Header right side: `{displayName}` text + `SignOutButton`. **No workspace/account switcher** —
  there is exactly one account per signed-in session, so none is needed.
- Current plan/usage messaging: `/app/billing` shows `{domainCount} / {plan.savedDomainLimit}
saved domains`; `DomainsManager.tsx` repeats the same figure inline.

## Current group model (detail)

- Flat, single-level, single-owner (`domain_groups.owner_user_id`). No nesting, no client
  metadata beyond `name`.
- `deleteGroupIfEmpty` (`apps/web/src/lib/groups.ts:83`) **refuses to delete a non-empty group** —
  it does not reassign domains to "Ungrouped." This does not meet Phase 9 §16's requirement
  ("Handle deletion of nonempty group safely" by moving domains to Ungrouped or a destination) —
  addressed in this phase (see `DOMAIN_GROUP_MODEL.md`).
- `DomainsManager.tsx` already labels the group column "Client group" — the UI-facing term is
  already decided; this phase keeps it (see `PHASE_09_CLIENT_ENTITY_DECISION.md`).

## Current import/export (detail)

- **Import**: `POST /api/domains/batch-import`, JSON body `{targets: string[], groupId?}`. Client
  splits a pasted textarea by newline/comma (`DomainsManager.tsx:147`) before sending — there is
  no server-side CSV file parser, no file upload, no `display_name`/`notes`/`monitoring` columns,
  no preview step, no per-row duplicate-vs-invalid distinction beyond a single error string per
  row. Each row goes through the same `createDomain` duplicate/limit checks the single-add form uses.
  No persistent job record — the whole batch is processed synchronously in one request and the
  full per-row result array returned in the response body.
- **Export**: `GET /api/domains/export.csv`, no filtering by group/selection, fixed 8-column
  schema (Domain, Canonical origin, Preset, Monitoring, Score, Open findings, Last scan, Next
  scan). Already formula-injection-safe (`escapeCsvField`). Does not include notes (correct
  default per Phase 9 §47) and cannot, since there's no notes column in the export at all yet.
  `Content-Disposition: attachment` set; no explicit `Cache-Control` header on the route itself —
  it inherits `private, no-store` from the global deny-by-default middleware
  (`apps/web/src/middleware.ts`, Phase 11), confirmed by reading that middleware rather than
  assumed. Not a gap.

## Baseline audit scheduling — the load-bearing finding for import architecture

Neither the single-add (`POST /api/domains`) nor the existing JSON batch-import route triggers a
scan synchronously. A newly created domain row has `lastScanId: null`, `nextScanAt: null`. The
monitoring sweep's `claimDueDomains` (`apps/web/src/lib/monitoring.ts:47`) selects domains where
`monitoringState = 'active' AND (next_scan_at IS NULL OR next_scan_at <= now)`, ordered by
`next_scan_at ASC` — confirmed (Phase 8/11) that SQLite sorts `NULL` first in `ASC` order, so a
never-scanned domain is picked up by the very next scheduled sweep ahead of every already-scanned
domain, within the sweep's existing bounded batch size (`MAX_DOMAINS_PER_SWEEP = 20`, admin-tunable
via `monitoring_scan_batch_size`).

**This means baseline-audit processing for CSV import does not require any new job/queue
infrastructure.** The existing cron-driven, bounded, self-healing sweep already is the "existing
bounded scheduled processing" the Phase 9 prompt directs implementers to reuse (§24). CSV import's
own new work is therefore narrower than the prompt's phrasing might suggest: **create domain rows
safely and synchronously** (cheap — pure D1 writes, no outbound network call, so even 100 rows in
one request is safe), and let baseline scanning happen exactly the way it already does for every
other domain-creation path. See `CSV_IMPORT_WORKFLOW.md` for the full architecture this finding
enables.

## Current monitoring capacity safeguards (Phase 11)

- `docs/operations/MONITORING_CAPACITY_PLAN.md`: current default batch size (20) is flagged as
  already CPU-risky on Workers Free; realistic safe batch size is closer to 1–3/tick. Any Phase 9
  work that adds rows to the monitoring queue (imports, bulk monitoring-enable) must not assume
  more headroom than this — it must not add a _separate_ synchronous scanning path, and must rely
  on the existing sweep's own bound rather than a new one.
- No unresolved P0/P1 incident blocks agency workflows; `docs/performance/PHASE_11_PRODUCTION_CAPACITY_BASELINE.md`
  states monitoring capacity (RISK-008) is "not an active production problem today."

## Current account/ownership/authorisation model

- Every domain-owning row (`domains`, `domain_groups`, `shared_reports`) has a direct
  `owner_user_id` FK to `users.id`. No intermediate account/workspace entity anywhere in the
  schema (confirmed by grep across every `packages/database/src/schema/*.ts` file).
- Auth: session-cookie based, `requireSession()` (`apps/web/src/lib/auth/require-session.ts`),
  same-origin CSRF check built in, used uniformly by every authenticated API route.
- SRS §7 "User Roles" are plan-tier roles (Free/Solo/Pro/Agency/Super Admin), not team roles.
  SRS §38 "Future Scope" explicitly lists "Team member accounts" as **post-MVP, not yet
  authorised** — see `PHASE_09_TEAM_AND_MEMBERSHIP_DECISION.md`.

## Existing risk directly targeted at this phase

- **RISK-010** (`docs/risks/ACTIVE_RISKS.md`): agency-logo R2 objects can orphan on bulk
  revocation or account/domain purge; explicitly `Target phase: Phase 9`. A manual admin-triggered
  sweep already exists (`findAndCleanupOrphanedLogos`,
  `apps/web/src/lib/r2-orphan-cleanup.ts`) but is **not** wired into the daily retention cron —
  its own closure criteria ("An orphan-object sweep is added to the daily retention cron") is
  unmet. Addressed in this phase — see the completion report's Database section.
- **RISK-034**: `listDomains()` has a pre-existing per-row `openFindingsCountFor` N+1, bounded by
  the ≤100 saved-domain ceiling. Portfolio summary/table queries built in this phase are new code
  and are written N+1-free from the start; RISK-034 itself is not in this phase's scope to fix
  (documented, not silently carried forward as new debt).

## Super Admin

Existing admin routes (`apps/web/src/pages/admin/**`) include a global cross-tenant domains view,
shared-reports management, plans, entitlements, and capacity — but no dedicated view for domain
groups, CSV import/export, or agency-branding usage aggregates. This phase adds narrowly scoped
aggregate visibility per §39 (see the completion report's Super Admin section) rather than a new
admin section family.

## Commits merged after Phase 8/11 affecting agency workflows

None — `5ac3e1d` (Phase 8's own deployment-record commit) is the tip of `main` at the start of
this phase; no intervening work touched domains, groups, sharing, or branding.
