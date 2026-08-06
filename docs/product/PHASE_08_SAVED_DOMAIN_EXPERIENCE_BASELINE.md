# Phase 8 — Existing-State Baseline

Recorded before any Phase 8 change, against commit `2a8fd55` (main, post status/changelog trust
correction), production Worker `da3ee995-b18b-4b14-b169-735b2a1859b8`. Phase 11's own completion
report states plainly "Phase 8 is clear to begin"; this document is the evidence that claim was
checked rather than assumed.

## Saved-domain list

- Route: `apps/web/src/pages/app/domains/index.astro` (`/app/domains`) — a thin server-rendered
  shell (auth via `getPageSession`, fetches only the plan for `csvExportEnabled`/
  `batchImportLimit`) mounting a client-fetched React island,
  `apps/web/src/components/app/DomainsManager.tsx` (`client:load`), which fetches
  `GET /api/domains` and `GET /api/groups` on mount.
- Columns (`DomainsManager.tsx:182-252`, `DataTable`): Domain, Client group, Preset, Score,
  Findings, Monitoring, Actions — several hidden below `sm`/`md` via `hideBelow`.
- Sorting: none — no column is clickable.
- Filtering: client-side only, over the full in-memory list (group, monitoring state, score band,
  "only with open findings").
- Pagination: none. `listDomains()` (`apps/web/src/lib/domains.ts:39-48`) is an unlimited
  `SELECT` per user and `GET /api/domains` returns the whole array. This is low-risk today
  because `savedDomainLimit` hard-caps the row count per account at 100 (Agency) — see
  `SAVED_DOMAIN_INFORMATION_ARCHITECTURE.md` for why Phase 8 does not add pagination here.
- Monitoring-state display: plain underlined text link ("Active"/"Paused"), no `StatusChip`,
  no color/tone.
- Score display: raw integer or `—`; no band coloring or trend.
- Recent-change display: **none** — no "changed since last scan" indicator anywhere on the list.
- Plan-limit display: **none** on the list itself, despite `savedDomainLimit` being enforced
  server-side in `createDomain()`.
- Loading state: none — `DomainsManager` renders `null` while `domains === null` (blank flash).
- Empty states: `EmptyState` for zero domains and a separate one for "no domains match these
  filters" (`DomainsManager.tsx:362-366, 458-462`).

## Saved-domain detail page

- Route: `apps/web/src/pages/app/domains/[domainId].astro` (`/app/domains/:domainId`).
  Server-rendered; auth via `getPageSession`; ownership via `getOwnedDomain()`
  (`apps/web/src/lib/domains.ts:50-67`, scoped by `ownerUserId` + `isNull(deletedAt)` — a
  cross-tenant or soft-deleted lookup correctly renders `ErrorState`, not a redirect).
- Data queried server-side: the domain row, plus `listScansForDomain()`
  (`apps/web/src/lib/domains.ts:259-277`), capped at the 20 most recent scans, no further
  pagination.
- Sections today: back link, header (name/origin + "View latest report" link to
  `/audit/[lastScanId]`), Policy Health Score card, scan-history list (date, `triggeredBy`, a
  `StatusChip` rendering the **raw status enum string**, not a human label — see "Known gaps"
  below), and a right-rail `DomainDetailActions` island (`client:load`): preset select,
  monitoring on/off `Switch`, notes textarea, manual re-scan button, delete danger-zone.
- **No current-policy summary, no change timeline, no comparison, no sharing controls anywhere
  on this page** — a user must click through to `/audit/[lastScanId]` to see report content.
- Caching: no `Cache-Control` header set anywhere in this path (defaults apply — see
  Caching section below).
- Auth: page-level `getPageSession`; API mutations (`PATCH`/`DELETE`/`POST .../scan`) go through
  `requireSession` (`apps/web/src/lib/auth/require-session.ts`).
- UX gap: preset change and rescan both trigger `window.location.reload()`
  (`DomainDetailActions.tsx:46,77`) rather than a local refresh; `patch()` calls for preset/notes/
  delete do not check `response.ok` or surface failures.

## Existing deterministic policy-summary model (Phase 5)

`apps/web/src/lib/policy-summary.ts` — `computePolicySummary(report: AuditReportResponse):
PolicySummary` has exactly the six categories Phase 8 needs (`aiSearchDiscoverability`,
`trainingPolicyDeclaration`, `userTriggeredRetrieval`, `agentAccess`, `crossSignalConsistency`,
`monitoring`), each drawn from a fixed `PolicySummaryLabel` union. Only consumer today:
`apps/web/src/components/AuditReportView.tsx` on `/audit/[auditId]` — never called from the
saved-domain detail page. **Known bug for Phase 8 to fix:** `monitoring` is hardcoded to the
literal `"Not enabled"` (`policy-summary.ts:207`) regardless of the domain's real monitoring
state — misleading if reused as-is on a page where monitoring may be genuinely active.

## Change-detection model (`scan_diffs`)

- Schema: `packages/database/src/schema/domains-scans.ts:194-207`. `diffType` is a 3-value enum
  (`website_drift | registry_drift | preset_change`); Phase 11 (migration `0022`) made both scan
  FKs nullable with `ON DELETE SET NULL` so a diff survives its referenced scans aging out under
  retention (`domain_id`'s `ON DELETE CASCADE` is unchanged — a diff still dies with its domain).
- Generation: `computeScanDrift()` in `apps/web/src/lib/monitoring.ts:99-142` — compares
  **evaluated crawler outcomes** (`scan_crawler_results.result`) between the previous and current
  scan, plus registry-version identity. It does **not** diff raw robots.txt/meta/HTTP-header/
  canonical/llms.txt/RSL/Content Signals text, even though `scan_resources.resourceHash` and
  `snapshotText` exist per-scan per-resource-type and were confirmed by the Phase 11 completion
  report to be populated "for future change-detection use."
- **`diffType` is 3-way, not the 6-way (website-policy / registry / mixed / operational /
  uncertain / baseline) attribution Phase 8 needs**, and today collapses "both changed" into
  `registry_drift` (`monitoring.ts:159`) — the fact that the website also changed is only
  recoverable by re-parsing `details`, never surfaced as its own state. `preset_change` is a
  schema value nothing currently writes.
- **`scan_diffs` has no read path at all.** Only `monitoring.ts` writes it; no API route, lib
  query function, or UI reads it — confirmed via full-repo grep. This is exactly the gap the
  Phase 2 messaging-surface audit flagged and explicitly deferred to Phase 8
  (`docs/brand/MESSAGING_SURFACE_INVENTORY.md`, item C5).
- Finding fingerprint: `packages/policy/src/findings.ts:62-70,96`, a non-cryptographic hash over
  `[code, affectedCrawlerId, evidence]`. Persisted only inside `findings.evidence`'s JSON blob
  (`apps/web/src/lib/persist-scan.ts:244-267`), not a first-class indexed column.

## Monitoring, rescan, sharing (Phase 6/existing)

- Monitoring states: schema only has `monitoringState: "active" | "paused"` and
  `monitoringFrequency: "none" | "monthly" | "weekly"` (plan-driven). There is **no** "baseline
  pending" domain-level state in the data model — a saved domain always has a real state from
  creation; "no scans yet" is a derived UI condition (`lastScanId === null`), not a stored state.
  Auto-pause fires after `FAILURE_PAUSE_THRESHOLD = 5` consecutive scan failures
  (`monitoring.ts:22,205-243`).
- `domains.nextScanAt` is computed (`computeNextScanAt`, `apps/web/src/lib/scan-scheduling.ts`)
  and stored, but **never rendered anywhere in the current UI** — only exposed via CSV export.
  Phase 8 is the first UI surface to display it.
- Manual rescan: `POST /api/domains/:domainId/scan`
  (`apps/web/src/pages/api/domains/[domainId]/scan.ts`). Quota enforced by counting `scans` rows
  this UTC calendar month (`countManualScansThisMonth`, `domains.ts:232-248`) — no separate
  ledger table. **No duplicate-simultaneous-scan prevention exists** — two concurrent rescan
  requests can both pass the quota check and both run; `scans.status` has a `"running"` value but
  nothing currently sets/reads it as a lock. Confirmed real gap; Phase 8 §26 explicitly requires
  fixing this ("Prevent duplicate simultaneous scans").
- Plan table confirmed against `packages/database/seed/reference-data.sql:39-49` — **matches the
  Phase 8 prompt's stated table exactly**: rescans/month Free=2/Solo=5/Pro=10/Agency=20; monitoring
  frequency none/monthly/weekly/weekly; saved-domain limit 1/5/25/100; retention 30/365/730/1095
  days (12/24/36 months). No drift to correct.
- Sharing: `apps/web/src/lib/sharing.ts` — 32-random-byte base64url token, only its SHA-256 hash
  persisted (opaque, unguessable, revocable, optionally time-limited). Public view
  `apps/web/src/pages/shared/[token].astro` sets `noindex`; no per-route cache override, so the
  global middleware default (`Cache-Control: private, no-store`,
  `apps/web/src/middleware.ts:69-83`) applies. This is per-_report_ sharing, not per-domain — no
  timeline is exposed through it today, which is the correct starting point per this phase's own
  "do not expose timeline through a share unless explicitly authorised" rule.

## Crawler registry, plans, analytics

- `getActiveRegistry(db)` (`apps/web/src/lib/registry-data.ts:20-33`) — `WHERE isActive = true`
  on `registry_versions`/`ruleset_versions`. Public changelog: `apps/web/src/pages/changelog.astro`.
  Public crawler directory: `apps/web/src/pages/crawlers/[slug].astro`.
- Canonical plan source: `apps/web/src/lib/plan.ts`'s `getPlan()` — explicitly commented as the
  single source every entitlement check must read from. `apps/web/src/lib/billing/
plan-catalog.ts` is a documented superset (Paddle pricing/marketing copy only), never a
  competing source. Phase 8 reuses `getPlan()` for every monitoring/rescan/retention check.
- Analytics: `apps/web/src/lib/analytics.ts` — `PRODUCT_EVENT_NAMES` literal union +
  `trackEvent(db, name, {userId, anonymousId, properties})`, one row per event in
  `product_events`. Pattern (grouped comment block per phase) is followed for the new Phase 8
  event names.

## Caching and auth for account routes

No route under `/app/domains/*` sets an explicit `Cache-Control` header; the global middleware
(`apps/web/src/middleware.ts:69-83`) defaults every response without its own header to
`private, no-store`. This is already the safe default Phase 8 must preserve for every new route.

## SRS and roadmap constraints confirmed before design

- SRS §25 requires the saved-domain fields and actions Phase 8 must show/preserve; §10.29 requires
  a timeline showing scan date/trigger/score/material changes/website drift/registry
  drift/failures/preset changes/admin scans, each with a summary and a comparison link; a visual
  chart is optional, detailed text history is not.
- **The literal phrase "policy objective" appears nowhere in the SRS.** What the SRS actually
  authorizes is per-domain selection among 4 fixed presets (§18/§25, already implemented,
  `packages/policy/src/presets.ts`), with preset changes required to appear in account history
  (feeding directly into the Phase 8 timeline as an "operational" event type). §38 "Future Scope"
  explicitly defers "custom policy matrices" indefinitely. See
  `PHASE_08_POLICY_OBJECTIVE_DECISION.md` for the full disposition.
- Finding-lifecycle states (appeared/persisting/changed/resolved) are **not defined anywhere in
  the SRS** — a genuine design gap this phase fills against the existing fingerprint/finding data
  model, documented in `FINDING_LIFECYCLE_MODEL.md`.
- Requirements traceability: §25 and §26 are `partially-satisfied`; no row exists yet for §10.29
  (the timeline UI) — this phase is where that gets built and traced.
- Active risks relevant here: RISK-008 (Workers Free CPU budget, `MAX_DOMAINS_PER_SWEEP=20`) means
  any new query pattern this phase adds must stay bounded; RISK-006 (`product_events`/
  `security_events`/`notifications` have no purge job) is noted so the new `domain_change_events`
  table's own retention is designed deliberately rather than left equally unbounded.
- Messaging-surface audit items **C3** and **C5** (`docs/brand/MESSAGING_SURFACE_INVENTORY.md`)
  are explicitly assigned to Phase 8: reuse `AuditReportView.tsx`'s `STATUS_LABEL`/`STATUS_TONE`
  maps on the scan-history list instead of raw enum text (C3), and give `scan_diffs`/`diffType` a
  real customer-facing UI surface (C5) — both addressed by this phase's timeline work.

## Not carried into this phase

The roadmap's own Phase 8 objective (`docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md`)
also lists two unrelated backlog items neither Phase 6 nor Phase 7 claimed: reconciling the SRS
§2.3 Primary Tagline with the brand system (RISK-028), and adding `"description"` fields to 10
`package.json` files that lack one. Per this phase's own explicit prompt and scope boundaries
(saved-domain experience and change timeline only), these are **not** in scope for this pass and
are left open, tracked at their existing risk/backlog entries rather than silently absorbed or
silently dropped.
