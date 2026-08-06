# Incident Tracking System — Design

Status: proposed, pending implementation in this same change. This document is written before
the migration/code exist, per the standing rule that schema and public-status-page changes get
designed on paper first. Once implemented, keep this document in sync with reality — if the code
and this document disagree, fix whichever is wrong, don't let them silently drift.

## 1. Problem statement

The current `/status` page (`apps/web/src/pages/status.astro`) is a static capability checklist —
"is the audit engine enabled in this environment," "is Paddle configured" — not a real incident
history. It has no concept of an ongoing incident, a scheduled maintenance window, or a resolved
incident, and (per the earlier audit) briefly exposed an internal admin-tooling row ("Super Admin
Control Center") before that was removed. There is no database table backing any of this.

This design adds a minimal, additive incident-tracking system: a Super Admin can open, update, and
resolve incidents against a fixed list of customer-facing components; the public `/status` page
renders active incidents, scheduled maintenance, and recent resolved incidents from real data,
never a hardcoded "Operational."

## 2. Non-goals

- **No uptime percentage.** No reliable historical uptime measurement exists yet (confirmed in the
  original audit). Never publish a fabricated number. **Updated (Public Status and Changelog Trust
  Correction)**: the public page previously explained this absence with a sentence explicitly
  naming it as a gap ("CrawlPact does not yet have reliable historical uptime measurement in
  place...") — found, on review, to itself read as trust-reducing rather than reassuring, and
  removed without a replacement negative explanation. The page's existing "Recently resolved"
  section already serves the neutral service-history role a visitor needs; it does not need its
  own explanation for why a percentage is absent — see §7 and
  `docs/reports/PUBLIC_STATUS_AND_CHANGELOG_TRUST_CORRECTION_REPORT.md`.
- **No paging/alerting integration.** Creating an incident does not send email/SMS/Slack — that
  would reintroduce exactly the external-notification-provider dependency SRS §6.2 prohibits.
  Incident visibility is the public status page itself, plus the optional Atom feed (§7).
- **No replacement of the existing internal health checks** (`apps/web/src/lib/admin/health.ts`).
  Those keep computing real-time operational signals (D1 reachability, scheduler/retention job
  status, webhook/auth failure rates) for the admin-only `/admin/health` page. This system adds
  incidents as a second, admin-curated signal layered on top for the _public_ page — it does not
  remove or fork the existing internal health logic.

## 3. Data model

Two new tables, additive only (no changes to existing tables), following this repo's established
conventions exactly (verified against `packages/database/src/schema/admin-security.ts` and
`notifications-sharing.ts`'s `systemNotices`, and `packages/database/migrations/0007`/`0015`):

### `incidents`

| Column                     | Type                                                                                                             | Notes                                                                                                                                                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                       | `TEXT PRIMARY KEY`                                                                                               | App-generated (`crypto.randomUUID()`), matching `system_notices`/`blocked_targets` — an entity table, not an append-only log.                                                                                                                  |
| `title`                    | `TEXT NOT NULL`                                                                                                  |                                                                                                                                                                                                                                                |
| `public_summary`           | `TEXT NOT NULL`                                                                                                  | The public impact description shown on `/status`.                                                                                                                                                                                              |
| `severity`                 | `TEXT NOT NULL CHECK (severity IN ('minor','major','critical'))`                                                 | Drives the public overall-status escalation (§6).                                                                                                                                                                                              |
| `status`                   | `TEXT NOT NULL CHECK (status IN ('investigating','identified','monitoring','resolved')) DEFAULT 'investigating'` | Current workflow state.                                                                                                                                                                                                                        |
| `affected_components`      | `TEXT NOT NULL`                                                                                                  | JSON array of canonical component keys (§5) — reusing the existing repo convention of a `-- JSON` text column (e.g. `previous_state`/`new_state` on `admin_audit_logs`) rather than a join table, since the component list is small and fixed. |
| `is_scheduled_maintenance` | `INTEGER NOT NULL DEFAULT 0 CHECK (is_scheduled_maintenance IN (0,1))`                                           | Distinguishes planned maintenance from an unplanned incident — same rendering pipeline, different public section (§7).                                                                                                                         |
| `is_public`                | `INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0,1))`                                                          | Lets an admin draft an incident before it's visible — mirrors `system_notices.is_published`.                                                                                                                                                   |
| `starts_at`                | `TEXT NOT NULL`                                                                                                  | ISO-8601. For maintenance, may be in the future (scheduled).                                                                                                                                                                                   |
| `resolved_at`              | `TEXT`                                                                                                           | Nullable; set when `status` transitions to `resolved`.                                                                                                                                                                                         |
| `created_by_user_id`       | `TEXT REFERENCES users(id) ON DELETE SET NULL`                                                                   | Nullable from day one — see §4, do not repeat the bug `0013`–`0015` had to fix retroactively.                                                                                                                                                  |
| `created_at`               | `TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))`                                                   |                                                                                                                                                                                                                                                |
| `updated_at`               | `TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))`                                                   | Updated on every status change.                                                                                                                                                                                                                |

### `incident_updates`

The public timeline ("Updates") for an incident — one row per posted update, including the
initial one.

| Column               | Type                                                                                     | Notes                                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                 | `INTEGER PRIMARY KEY AUTOINCREMENT`                                                      | Append-only log style, matching `admin_audit_logs`/`security_events` — never updated or deleted.                                                        |
| `incident_id`        | `TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE`                               | Structural parent-child FK (not a user-actor reference, so `ON DELETE CASCADE` — not the actor-reference `SET NULL` pattern — is correct here; see §4). |
| `status`             | `TEXT NOT NULL CHECK (status IN ('investigating','identified','monitoring','resolved'))` | The workflow state as of this specific update — lets the timeline show state transitions, not just free text.                                           |
| `message`            | `TEXT NOT NULL`                                                                          |                                                                                                                                                         |
| `created_by_user_id` | `TEXT REFERENCES users(id) ON DELETE SET NULL`                                           | Nullable, same reasoning as `incidents.created_by_user_id`.                                                                                             |
| `created_at`         | `TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))`                           |                                                                                                                                                         |

Indexes: `idx_incidents_status`, `idx_incidents_is_public`, `idx_incident_updates_incident_id`
(query patterns: "active public incidents," "updates for incident X in order").

**Audit history**: not a new table. Every create/update/resolve action goes through
`requireAdminAction`, which already writes to `admin_audit_logs` (action, target, reason,
administrator, timestamp) — reusing this avoids a second, redundant audit mechanism. This matches
how `system_notices` already does it.

## 4. Why actor references are nullable with `ON DELETE SET NULL`

Migrations `0013`–`0015` exist because every FK to `users(id)` without an explicit `ON DELETE`
clause defaults to SQLite's `NO ACTION`, which throws and **aborts the daily account-deletion job**
the moment it tries to delete a user who created a historical row anywhere. `incidents.created_by_user_id`
and `incident_updates.created_by_user_id` are declared nullable with `ON DELETE SET NULL` from the
very first migration that creates them — not retrofitted later. `incident_updates.incident_id`,
by contrast, is a structural FK to a parent row this system itself owns (not a user), so
`ON DELETE CASCADE` is correct and unrelated to the actor-reference pattern.

## 5. Canonical public components

Fixed, shared list (not user-configurable), matching the customer-facing groupings the earlier
audit round already introduced conceptually for the status page:

```
website              "Website and public pages"
audit_scanner        "Audit and scanner"
accounts_passkeys    "Accounts and passkeys"
dashboard_domains    "Dashboard and saved domains"
scheduled_monitoring "Scheduled monitoring"
reports_sharing      "Reports and sharing"
billing_checkout     "Billing and checkout"
```

Defined once (`apps/web/src/lib/status/components.ts`) and imported by both the admin incident
form (checkboxes) and the public status page (rendering order and labels) — one source of truth,
so the two can't drift into different label text for the same key.

## 6. Statuses and severities

**Incident workflow status** (`investigating → identified → monitoring → resolved`) — matches the
task brief's requested states exactly, and mirrors how real status-page tools model an incident's
lifecycle. Not skippable in the schema (any value is legal at any time; the admin UI, not a DB
constraint, encourages the natural order since a real incident doesn't always pass through every
state).

**Severity** (`minor | major | critical`) — set once at creation, editable. Drives escalation:

| Severity   | Public component state | Public overall-status contribution                          |
| ---------- | ---------------------- | ----------------------------------------------------------- |
| `minor`    | Degraded performance   | Escalates overall status to at least "Degraded performance" |
| `major`    | Partial outage         | Escalates overall status to at least "Partial outage"       |
| `critical` | Major outage           | Escalates overall status to at least "Major outage"         |

A `is_scheduled_maintenance` incident maps its affected components to "Maintenance" instead of a
severity-derived state, regardless of its `severity` value (severity still matters for sorting/
display emphasis, just not for the outage-vs-maintenance distinction).

**Public overall status** (six states, computed, never hardcoded):

```
operational | degraded_performance | partial_outage | major_outage | maintenance | status_unavailable
```

Computed by a new "public status adapter" (§7) that combines:

1. The existing internal `getComponentHealth`/`getSystemStatusSummary` signals (unchanged) — the
   baseline.
2. Any active (`status != 'resolved'`, `is_public = 1`) incident's severity/maintenance flag for
   its listed `affected_components` — an **escalation only**: an incident can make a component's
   displayed status worse than the internal baseline, never better, and never silently override an
   internal "degraded" back down to "operational."
3. If the adapter itself fails (DB unreachable, query error) — `status_unavailable` for the
   affected component/overall status, never a default "operational." This is the same principle
   `getComponentHealth` already applies to its own checks, extended to the public page.

## 7. Public status page behaviour

`/status` (SSR, `prerender = false`, unchanged) renders, in this order:

1. **Overall status banner** — one of the six states above, plus "Last checked" timestamp in UTC.
2. **Component statuses** — the 7 canonical components (§5), each showing its resolved state per
   the escalation rule in §6, and (for components with an internal health signal already computed
   — audit engine enabled, Paddle configured) the existing real config-derived detail text
   preserved, not replaced.
3. **Current incidents** — any `status != 'resolved'`, `is_scheduled_maintenance = 0`,
   `is_public = 1` incident: title, severity, affected components, and its full update timeline
   (oldest first).
4. **Scheduled maintenance** — any `is_scheduled_maintenance = 1`, `status != 'resolved'`,
   `is_public = 1` incident, labelled distinctly from an unplanned incident even though it shares
   the same underlying table and workflow states.
5. **Recently resolved incidents** — `status = 'resolved'`, `is_public = 1`, most recent 10,
   ordered by `resolved_at` descending, each showing its resolution time and a link to its full
   update history.
6. **Historical uptime information** — an explicit, honestly-worded statement that reliable
   historical uptime measurement is not yet available, rather than omitting the section or
   publishing a fabricated percentage. This satisfies "clearly distinguish... historical uptime
   information" without inventing a number `docs/status/KNOWN_RISKS.md` would then have to
   disclaim.
7. Unchanged: explanation of what the page covers, links to `/security` and a support/request
   channel (existing links preserved).

**What is never shown**: exact security-event counts, internal configuration/secret names, target/
customer identifying information, or any internal admin-tooling label (the original audit's
"Super Admin Control Center" mistake) — the public status adapter (§8) is the enforcement point
for this, not a convention admins have to remember by hand each time.

**Caching**: SSR response gets a short `Cache-Control: public, max-age=30` (or similar short TTL)
so the page doesn't show minutes-stale incident state during an actual event, while still allowing
brief edge caching under normal load — consistent with "set appropriate caching so the status page
does not show misleadingly stale information" from the original brief.

**Optional Atom feed**: `apps/web/src/pages/status/feed.xml.ts` (public, unauthenticated,
`prerender = false`) mirroring current + recently-resolved public incidents, reusing the same
"private Atom feed" XML-building pattern already used for `feed/[token].xml.ts` minus the
token/auth check (this one is intentionally public). Feasible without any new external
email/SMS dependency, per the brief. Scoped as a fast-follow if time allows — not required for the
core feature to be complete.

## 8. Admin workflow

New Super Admin section, "Incidents," added to `AdminNav.astro`'s **Security** group (operational
health is a security/reliability concern in this repo's existing grouping) — a new
`{ label: "Incidents", href: "/admin/incidents" }` entry alongside "Blocked targets"/"Audit logs".

Structure mirrors the `system_notices` feature exactly (chosen as the template because its
shape — title, body/summary, severity enum, publish/unpublish toggle, admin-authored, no
customer-facing self-service — is the closest existing analog):

- `apps/web/src/pages/admin/incidents/index.astro` — Astro shell (`getAdminPageSession`, redirect
  to `/sign-in` if absent) rendering `<IncidentsManager client:load />`.
- `apps/web/src/components/admin/IncidentsManager.tsx` — React island: create form (title,
  summary, severity, affected components checkboxes, scheduled-maintenance toggle, initial
  status/message, public/draft toggle, reason), list of existing incidents with their current
  status, and a "post update" action per incident (new status + message + reason) that appends an
  `incident_updates` row and updates `incidents.status`/`updated_at`/`resolved_at`.
- `apps/web/src/pages/api/admin/incidents/index.ts` — `GET` (list, `requireAdminSession`) /
  `POST` (create, `requireAdminAction` with `action: "incident.create"`).
- `apps/web/src/pages/api/admin/incidents/[incidentId]/updates.ts` — `POST` (post a status
  update, `requireAdminAction` with `action: "incident.update"`); sets `resolved_at` when the
  posted status is `resolved`.
- `apps/web/src/lib/admin/incidents.ts` — the DB-access layer (`listIncidents`, `createIncident`,
  `addIncidentUpdate`), mirroring `lib/admin/notices.ts`'s shape.

Not role-gated beyond "has any active admin role" (matching `system_notices`/`blocked_targets` —
neither passes a narrower `role` option today); if the product owner later wants this scoped to a
specific role (e.g. `content_manager` or a new `incident_manager`), that's a one-line change to
add `role: "..."` to the `requireAdminSession`/`requireAdminAction` calls, not a schema change.

No public self-service reporting (customers can't file incidents) — this is an internal tool, per
the brief's "Add appropriate Super Admin management UI."

## 9. Migration plan

One new migration, `packages/database/migrations/0018_incidents.sql` (next number after the
current highest, `0017`), containing both `CREATE TABLE` statements and their indexes — purely
additive, no `ALTER`/`DROP` of any existing table, no data migration needed (no prior incident
data exists anywhere to migrate). Drizzle mirror: new file
`packages/database/src/schema/incidents.ts`, re-exported from `schema/index.ts`, verified against
the migration by `pnpm db:validate` (table/column name presence check — see research notes; it
will fail loudly if the two drift).

**Existing production data**: entirely unaffected. This migration creates two new, empty tables;
it does not touch `users`, `admin_audit_logs`, or any other existing table's rows or schema.

## 10. Rollback plan

Because this is purely additive:

- **Code rollback**: revert the deploy. The new tables remain in the database, unused — harmless,
  since nothing else references them.
- **Schema rollback** (only if the tables themselves must be removed, e.g. a design change):
  a new forward-only migration `0019_drop_incidents.sql` with `DROP TABLE incident_updates;
DROP TABLE incidents;` (child table first, for the FK) — never edit or delete `0018` itself,
  per this repo's forward-only migration rule (ADR-0002). This is a data-loss operation for
  whatever incidents were recorded by then, so it should only be done deliberately, not as a
  routine rollback step.
- **No production data is put at risk by adding this feature**, and no production data is put at
  risk by _not_ rolling it back — the tables are additive and inert until the admin UI is actually
  used.

## 11. Testing plan

- **Unit**: `packages/database` — none needed beyond `db:validate` (schema/migration agreement).
  `apps/web/src/lib/admin/incidents.ts` and the public status adapter
  (`apps/web/src/lib/status/public-status.ts`) get unit tests against an in-memory/test D1
  instance, following the existing `*.test.ts` colocation convention: incident creation, status
  transitions, the escalation rule (an incident always escalates, never de-escalates, the base
  internal signal), the "no active incidents → operational" baseline, and the
  DB-failure → `status_unavailable` path.
- **Integration**: a new `apps/web/tests/integration/admin-incidents.integration.test.ts`
  (mirroring `admin-registry.integration.test.ts`'s shape) covering: create requires a valid admin
  session + reason (same `requireAdminAction` contract every other admin mutation already has),
  posting an update transitions status and sets `resolved_at` only on `resolved`, a non-public
  incident does not appear in the public status computation, and the admin audit log gets a real
  row for each action (reusing the existing audit-log assertions pattern from other admin
  integration tests).
- **a11y/responsive**: the public `/status` page changes are exercised by the existing
  `apps/web/tests/a11y/home.spec.ts` (already covers `/status` in its route list) and
  `responsive-smoke.spec.ts` — no new test file needed there, just confirm both still pass after
  the page's content changes.
