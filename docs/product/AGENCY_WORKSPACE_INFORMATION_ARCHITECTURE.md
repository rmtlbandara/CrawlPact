# Agency Workspace Information Architecture

Route: `/app/workspace` (new). Added to `AppNav.astro` / `AppMobileNav.tsx` as "Workspace",
positioned after "Overview" and before "Domains" — it is the portfolio-level entry point;
`/app/domains` remains the flat, ungrouped domain-management view Phase 8 built, unchanged.

Per `PHASE_09_WORKSPACE_MODEL_DECISION.md`, "workspace" here means "your account's portfolio view"
— every query is scoped to `owner_user_id = user.id`, identical to every other authenticated route.

## Section 1 — Workspace header

Answers: _whose portfolio is this, what plan, how much room is left?_

- Account display name, current plan name
- Saved domains used / limit (reuses the exact figure already shown on `/app/billing` and
  `/app/domains` — one shared helper, not a third computation)
- Monitoring coverage: count of domains with `monitoringState = 'active'`
- Data-refresh timestamp (server render time — see `PORTFOLIO_SUMMARY_MODEL.md` for why this is
  not called "real-time")
- Primary actions, each rendered only when the plan/state authorises it: Add domain, Import
  domains (Pro/Agency only), Create group (Pro/Agency only), Export domains (Pro/Agency only),
  Review pricing (always, links to `/pricing`)

No "Verified agency" / "Certified" / "Official partner" badge — none of those are independently
verified, so none appear (§12).

## Section 2 — Portfolio summary

Explainable counts, each linking to a filtered `/app/workspace/domains` view. See
`PORTFOLIO_SUMMARY_MODEL.md`.

## Section 3 — Attention queue

Bounded, paginated, deterministic. See `PORTFOLIO_ATTENTION_MODEL.md`.

## Section 4 — Recent portfolio changes

Account-wide aggregation of Phase 8 `domain_change_events`, filterable by group/change-origin/
attention-level/date. See `PORTFOLIO_ATTENTION_MODEL.md` (shares the same query module as the
attention queue).

## Section 5 — Domain groups

A compact list (name, domain count, link to `/app/groups/[groupId]`) with a "Manage groups" link
to the existing `/app/groups` page — this phase does not duplicate `GroupsManager.tsx`'s full CRUD
UI inside the workspace page; it links to the one canonical place groups are managed, consistent
with "domain evidence remains authoritative" (§6.2) applied to groups.

## Section 6 — Managed domains

The portfolio table — the Phase 9 superset of `DomainsManager.tsx`, with server-side pagination.
See `DOMAIN_GROUP_MODEL.md` §"Portfolio table" and the Managed-Domain Portfolio Table requirements
(prompt §19). Lives at `/app/workspace/domains` (its own route, linked from Section 6's "View all"
and from every Section 2/3/4 count) rather than being fully inlined on `/app/workspace` itself, so
the workspace landing page stays a genuine overview rather than a second full domain list.

## Section 7 — Import and export actions

Entry points into the CSV import wizard (`/app/workspace/import`) and CSV export (existing
`/api/domains/export.csv`, extended — see `CSV_EXPORT_WORKFLOW.md`), both gated on
`plan.csvExportEnabled`/`plan.batchImportLimit > 0`.

## Section 8 — Agency report branding

Entry point into the existing branding settings (extended in this phase — see
`AGENCY_BRANDING_MODEL.md`), gated on `plan.agencyBrandingEnabled`. Shown, disabled with upgrade
messaging, when the plan doesn't include it (never hidden entirely without explanation — §38).

## Section 9 — Plan usage and limits

A factual table: saved domains used/limit, batch-import limit, domain-group availability,
CSV-export availability, Agency-branding availability, monitoring frequency, history retention —
all read from `getPlan()`, none hard-coded (§38).

## What is deliberately absent

- No account/workspace switcher (`PHASE_09_WORKSPACE_MODEL_DECISION.md`)
- No "Invite team" / "Members" controls (`PHASE_09_TEAM_AND_MEMBERSHIP_DECISION.md`)
- No opaque portfolio health score (`PORTFOLIO_SUMMARY_MODEL.md`)
- No multi-domain PDF/report generator (`PHASE_09_PORTFOLIO_REPORT_DECISION.md`)
- No cross-domain comparison UI (`PHASE_09_CROSS_DOMAIN_COMPARISON_DECISION.md`)

## Caching and indexability

Every route under `/app/workspace/**` and every new `/api/**` route this phase adds is
`prerender = false` and requires `requireSession`. Both `Cache-Control: private, no-store` and
`X-Robots-Tag: noindex, nofollow, noarchive` are already applied automatically by the global
`apps/web/src/middleware.ts` deny-by-default policy (Phase 11) to every path under `/app`, `/api/`,
`/admin`, and `/shared/` that doesn't set its own `Cache-Control` — no new route in this phase sets
one, so all of them inherit the private/no-store/noindex default with zero additional code. This
phase adds explicit cache-isolation tests (`PHASE_09_AGENCY_WORKSPACE_THREAT_REVIEW.md`) to confirm
the new routes are actually covered by this existing mechanism rather than assuming it.
