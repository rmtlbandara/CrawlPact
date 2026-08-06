# Phase 8 — Saved-Domain Experience and Change Timeline Completion Report

## Executive summary

Before this phase, the saved-domain experience had no timeline at all — `scan_diffs` was written
by the scheduled sweep but never read by anything (confirmed by a full-repo grep during baseline
research), so a customer who saved a domain had no way to see _what changed_, only the raw scan
history and the latest score. The domain-detail page showed a score card and a 20-row,
unpaginated scan list with raw status-enum text; there was no current-policy summary, no
before/after comparison, no distinction between a website-driven change and a registry-driven
one, and monitoring's own `nextScanAt` field had never been surfaced in any UI despite being
computed and stored since Phase 6.

This phase adds: a deterministic, versioned change-attribution model
(`website_policy | registry_driven | mixed | operational | uncertain | baseline`) built on
`scan_resources.resourceHash` (populated by Phase 11 "for future change-detection use," now
actually used); a materialised, paginated, idempotent policy-change timeline
(`domain_change_events`); a real before/after comparison view with escaped evidence and
finding-lifecycle classification (appeared/persisting/changed/resolved); a redesigned domain-detail
page reusing the existing report-rendering and sharing components rather than duplicating them; and
a redesigned saved-domain list with a plan-limit indicator, monitoring status chips, and a
real "recent change" column. Along the way, two real, previously-unguarded gaps were found and
fixed: no duplicate-simultaneous-scan prevention on manual rescans, and a hardcoded
`monitoring: "Not enabled"` bug in the reused policy-summary function.

## Starting state

- Starting commit: `2a8fd55` (main, post status/changelog trust correction), Worker version
  `da3ee995-b18b-4b14-b169-735b2a1859b8`.
- Migration state: 28 migrations before this phase (0001–0025 plus none pending); this phase adds
  0026–0028.
- Prior-phase reports read: Phase 5 (`PHASE_05_ANONYMOUS_AUDIT_CONVERSION_COMPLETION_REPORT.md`,
  the conversion flow this phase builds on), Phase 11
  (`PHASE_11_DATABASE_STORAGE_PERFORMANCE_COMPLETION_REPORT.md`, whose completion report states
  "Phase 8 is clear to begin" and confirms the `scan_diffs` FK fix and `resource_hash` population
  this phase depends on).
- Existing domain-list behaviour, existing detail-page behaviour, existing diff model, and existing
  query/performance baseline: fully recorded in
  `docs/product/PHASE_08_SAVED_DOMAIN_EXPERIENCE_BASELINE.md` before any code changed.

## Information architecture

Final domain-detail page order (`docs/product/SAVED_DOMAIN_INFORMATION_ARCHITECTURE.md`): header
and primary actions → current policy summary → what changed → monitoring status → policy-change
timeline → current findings/crawler-purpose/evidence (reused `AuditReportView`) → scan history →
domain settings and retention. This follows the Phase 8 prompt's own suggested order — baseline
research found no evidence justifying a deviation. The saved-domain list gained a plan-limit
indicator, a `StatusChip`-rendered monitoring column, a "recent change" column, search, and
default/last-scan/recent-change sorting, without adding pagination — a deliberate decision (the
100-domain Agency ceiling already bounds the row count; see the IA doc for the reasoning).

## Current-policy summary

Reused `computePolicySummary()` (`apps/web/src/lib/policy-summary.ts`) exactly as-is for the six
categories, fixing one real bug found during baseline research: `monitoring` was hardcoded to
`"Not enabled"` regardless of the domain's real state. The function gained an optional
`savedDomainMonitoringState` parameter (only the domain-detail page passes it) and the
`PolicySummaryLabel` union gained one new value, `"Active"`.

## Change attribution

Documented in `docs/product/DOMAIN_CHANGE_ATTRIBUTION_MODEL.md`, implemented in
`apps/web/src/lib/change-attribution.ts` (`computeChangeOrigin`). Six origins:
`website_policy` (a comparable resource-type hash differs, registry unchanged), `registry_driven`
(registry version differs, no comparable resource changed), `mixed` (both), `operational` (either
scan not `completed`/`completed_with_warnings`), `uncertain` (zero resource types comparable
between the two scans — e.g. retained evidence expired), `baseline` (no previous scan). Fully
deterministic (same two scan rows always produce the same result), versioned
(`ATTRIBUTION_MODEL_VERSION = "1"` stored on every generated event), and never infers intent — an
unavailable resource is `operational`, never a claimed deliberate block. 6 dedicated real-D1 tests
cover website-only, registry-only, mixed, no-change, partial-current-scan, and
zero-comparable-evidence scenarios (`domain-change-timeline.integration.test.ts`).

## Timeline

Documented in `docs/product/DOMAIN_CHANGE_TIMELINE_ARCHITECTURE.md` and
`DOMAIN_TIMELINE_EVENT_MODEL.md`. **Materialised** (Option B), not derived-on-read — a new
`domain_change_events` table (migration `0026`), one row per meaningful event, generated by
`generateTimelineEvent()`/`generatePresetChangeEvent()` in `apps/web/src/lib/domain-timeline.ts`.
Idempotency is a real unique index on a SHA-256 `fingerprint`
(`domainId|eventType|previousScanId|currentScanId|modelVersion`) plus `onConflictDoNothing()` —
proven by a real test calling `generateTimelineEvent` twice for the same scan pair and asserting
exactly one row exists. Pagination is cursor-based (`observed_at`, `id`), clamped to `[1, 50]`
server-side regardless of what a caller requests. Retention follows the same plan-tier
`historyRetentionDays` scans already use; FKs to `scans`/`registry_versions` are `ON DELETE SET
NULL` (matching the Phase 11 `scan_diffs` pattern), `domain_id` is `ON DELETE CASCADE`.

**Backfill**: Option A (none) — documented in `DOMAIN_TIMELINE_BACKFILL_POLICY.md`. The timeline
begins when this phase deploys; existing scan history remains fully visible in its own (now
paginated) section. Generation is wired into three real call sites: `monitoring.ts` (scheduled
sweep, both success and failure paths — a failed scan now correctly produces an `operational_change`
event when a prior scan exists), `scan.ts` (manual rescan), and `audit-continuation.ts`'s
`establishBaseline()` (the Phase 5 conversion flow's first scan — both the "adopt" and "rerun"
paths now generate a real `baseline` event, closing a gap found during e2e testing where a
freshly-converted domain had zero timeline events despite having a real completed scan).

## Finding lifecycle

Documented in `docs/product/FINDING_LIFECYCLE_MODEL.md`, implemented in
`apps/web/src/lib/finding-lifecycle.ts`. `findings.fingerprint` (already computed at persist time,
previously buried in a JSON blob) is now a first-class column (migration `0027`, backfilled from
existing rows via `json_extract`), making appeared/persisting/changed/resolved classification a
direct column comparison rather than a per-row JSON parse. `resolved` is never claimed against a
non-comparable current scan — proven by a dedicated test.

## Comparison

Documented in `docs/product/DOMAIN_COMPARISON_MODEL.md`, implemented in
`apps/web/src/lib/domain-comparison.ts`, served by
`/api/domains/:domainId/compare/:previousScanId/:currentScanId` and the authenticated page at the
same path. Comparability requires both scans to be complete and to belong to the requesting
user's own domain — a scan ID from another account produces the identical `incompatible`
result a made-up ID would (no existence oracle), proven by a real cross-domain test. Evidence is
rendered through JSX text nodes only (no `dangerouslySetInnerHTML` anywhere in this phase);
confirmed inert in a real browser by `saved-domain-timeline.spec.ts`'s "evidence renders as inert
text" test.

## Monitoring and rescans

`docs/product/MONITORING_STATUS_UX_MODEL.md` documents the displayed-state derivation (no new
stored states — presentation only) and the one real, previously-unguarded gap this phase closed:
**duplicate-simultaneous-scan prevention**. `domains.scan_lock_until` (migration `0028`) plus
`apps/web/src/lib/scan-lock.ts`'s `tryClaimScanLock`/`releaseScanLock` — a second concurrent
manual-rescan request for the same domain now receives a new `SCAN_ALREADY_RUNNING` (409) error
instead of both requests running `runAudit` at once; the scheduled sweep's own `claimDueDomains`
was extended to skip a domain a manual scan currently holds. `nextScanAt` is shown in the UI for
the first time. No monitoring frequency, quota, or notification-channel behaviour changed.

## Scan history and retention

`docs/product/SCAN_HISTORY_AND_RETENTION_UX.md`. The previous 20-row, unpaginated,
raw-status-enum inline list is replaced by `/api/domains/:domainId/scans` (server-side pagination,
7 filters) and a `DomainScanHistory` React island. **Closes messaging-audit item C3**
(`docs/brand/MESSAGING_SURFACE_INVENTORY.md`): `STATUS_LABEL`/`STATUS_TONE` were extracted from
`AuditReportView.tsx` into a new shared `apps/web/src/lib/scan-status-labels.ts` and both the
report view and the new scan-history list now import the same maps — no more raw
`"completed_with_warnings"` text on screen. Retention messaging (`retentionBoundaryFor()`) never
claims "full"/"permanent"/"unlimited" history or "no earlier change" when older rows have simply
aged out.

## Sharing and printing

Surfaced the existing, previously `/audit/:auditId`-only `ShareReportDialog` and print capability
directly on the domain-detail page — no new sharing mechanism, no new token model, no timeline
exposure through a share (an audit report share resolves only that one scan's report, with no
domain-scoped fan-out to timeline/comparison data).

## Policy objective

**Not authorised** — see `docs/product/PHASE_08_POLICY_OBJECTIVE_DECISION.md`. The SRS does not
contain the phrase "policy objective" anywhere; what it authorises is the existing 4-preset
selection (already implemented before this phase), with preset changes required to appear in
account history. This phase satisfies that existing requirement by generating a real
`operational_change` timeline event on a real preset change (`updateDomain()`) — it does not add a
new objective/preset-builder concept.

## Database

**Migrations** (all additive, applied fresh and validated with `pnpm run db:validate`):

- `0026_domain_change_events.sql` — new table + 2 indexes (domain+observed_at composite, unique
  fingerprint).
- `0027_findings_fingerprint_column.sql` — `ALTER TABLE findings ADD COLUMN fingerprint`,
  backfilled via `json_extract` from existing `evidence` JSON.
- `0028_domains_scan_lock.sql` — `ALTER TABLE domains ADD COLUMN scan_lock_until`.

`pnpm run db:validate` confirms migrations and the Drizzle schema stay in sync (43 tables verified
consistent). No destructive rewrite; old scan/finding rows remain fully readable (the fingerprint
backfill reads the same JSON blob the app already wrote).

## Performance

Every new list/timeline/scan-history query is bounded and indexed:
`idx_domain_change_events_domain_observed` (timeline pagination), the existing
`idx_findings_scan_id` (finding-lifecycle lookups, no new index needed — confirmed by code review
that the access pattern is always `scan_id IN (?, ?)` against ≤25 rows per scan). The saved-domain
list's new "recent change" column is fetched via one batched query for the whole page
(`getLatestChangeEventPerDomain`, a SQLite window-function query), explicitly avoiding an N+1
pattern — a pre-existing N+1 in the same function (`openFindingsCountFor`) was found but
deliberately left unfixed to keep this phase's change surface focused, and is recorded as
RISK-034 rather than silently left undocumented. No large charting library was added; the timeline
and comparison views use plain `<pre>`/list rendering with no animation.

## Security

Full threat review: `docs/security/PHASE_08_SAVED_DOMAIN_AND_TIMELINE_THREAT_REVIEW.md` — 20
threats reviewed against real code and real tests, not just a checklist. Highlights: every new
route resolves domain ownership before touching timeline/scan/comparison data (404, not a
distinguishable error, for another account's ID); `compareScans()` independently re-validates both
scan IDs belong to the requested domain; `domain_change_events` has no client-writable field and a
real unique-fingerprint idempotency guarantee; all evidence renders through JSX text nodes only.

## Accessibility

New pages/components follow the existing design-system conventions (labelled `<dl>` fields,
`StatusChip` with always-present text labels, no colour-only signal, keyboard-operable actions).
Two new automated a11y tests added to `apps/web/tests/a11y/home.spec.ts` (the empty saved-domain
list, and a real saved-domain detail page with a real current-policy summary and timeline) — both
pass with zero automatically-detectable WCAG 2.2 AA violations, alongside the existing 43 public
a11y tests (99 total, all passing).

## Analytics

`docs/analytics/PHASE_08_SAVED_DOMAIN_EVENT_MODEL.md` — 18 new first-party event names added to
`apps/web/src/lib/analytics.ts`'s existing `PRODUCT_EVENT_NAMES`, following the same
grouped-comment convention as every prior phase. No domain name, full URL, evidence, scan ID, or
timeline-event ID is ever sent as a property (matches the existing file-wide convention, verified
by code review of every new `trackEvent()` call site in this phase).

## Files created

**Libraries**: `apps/web/src/lib/{change-attribution,domain-timeline,domain-comparison,
finding-lifecycle,scan-history,scan-lock,scan-status-labels}.ts`.
**Components**: `apps/web/src/components/app/{DomainChangeTimeline,DomainScanHistory}.tsx`.
**Routes**: `apps/web/src/pages/api/domains/[domainId]/{timeline,scans}.ts`,
`apps/web/src/pages/api/domains/[domainId]/compare/[previousScanId]/[currentScanId].ts`,
`apps/web/src/pages/app/domains/[domainId]/compare/[previousScanId]/[currentScanId].astro`.
**Migrations**: `packages/database/migrations/{0026_domain_change_events,
0027_findings_fingerprint_column,0028_domains_scan_lock}.sql`.
**Tests**: `apps/web/tests/integration/{domain-change-timeline,domain-timeline-api}.integration.test.ts`,
`apps/web/tests/e2e/saved-domain-timeline.spec.ts`.
**Docs**: 9 files under `docs/product/`, 1 under `docs/analytics/`, 1 under `docs/security/`, this
report.

## Files modified

`apps/web/src/{components/{AuditReportView.tsx,app/DomainsManager.tsx},lib/{analytics.ts,
audit-continuation.ts,domains.ts,monitoring.ts,persist-scan.ts,policy-summary.ts},pages/api/
domains/[domainId]/scan.ts,pages/app/domains/{[domainId].astro,index.astro}}`,
`apps/web/tests/{a11y/home.spec.ts,integration/{audit-report-signals,public-status}
.integration.test.ts}`, `docs/api/ERROR_CATALOGUE.md`, `packages/core/src/api/{contracts/domains.ts,
errors.ts}`, `packages/database/src/schema/domains-scans.ts`.

## Routes created or changed

New: `GET /api/domains/:domainId/{timeline,scans}`, `GET /api/domains/:domainId/compare/
:previousScanId/:currentScanId`, `/app/domains/:domainId/compare/:previousScanId/:currentScanId`.
Changed (additive only): `GET /api/domains` (adds `recentChangeOrigin`/`recentChangeSummary` to
each row), `POST /api/domains/:domainId/scan` (adds the scan-lock claim/release and timeline-event
generation), `/app/domains` and `/app/domains/:domainId` (full redesign per the IA above).

## Validation

| Command                                                                                                                        | Result                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run format:check`                                                                                                        | PASSED                                                                                                                        |
| `pnpm run lint`                                                                                                                | PASSED (0 errors)                                                                                                             |
| `pnpm --filter @crawlpact/web run typecheck` (astro check)                                                                     | PASSED — 0 errors, 0 warnings, 71 pre-existing hints                                                                          |
| `pnpm run test:unit`                                                                                                           | PASSED — 339/339                                                                                                              |
| `pnpm run test:integration`                                                                                                    | PASSED — 228/228 (32 new: 24 in `domain-change-timeline.integration.test.ts`, 8 in `domain-timeline-api.integration.test.ts`) |
| `pnpm run db:validate`                                                                                                         | PASSED — 43 tables verified consistent                                                                                        |
| `pnpm run verify:push` (full local CI reproduction: quality gate + 118 Chromium E2E + 99 Chromium accessibility + secret scan) | PASSED — clean run, 0 failures                                                                                                |

New tests: 24 + 8 real-D1 integration tests (attribution, idempotency, pagination, finding
lifecycle, comparison IDOR, scan-lock, scan-history, retention); 9 new e2e tests exercising the
real anonymous-audit-to-saved-domain flow through to the new domain-detail page, list page, and
evidence-escaping; 2 new accessibility tests.

**Real bugs found and fixed during this phase's own testing** (not assumed correct on the first
attempt): (1) embedding the full `AuditReportView` component on the domain-detail page produced
two `<h1>` elements on one page — fixed by adding a `headingLevel` prop, defaulting to `"h1"` for
every existing caller and passing `"h2"` only from the new domain page; this also fixed a real,
pre-existing e2e test (`audit-conversion.spec.ts`) that started failing because of it. (2) A new
e2e locator (`getByText("Frequency")`) matched two elements because of Playwright's
case-insensitive substring matching against unrelated copy — fixed with `{ exact: true }`. (3) The
first version of this phase's own e2e test assumed a freshly-converted domain would have zero
timeline events — this assumption was itself wrong once the `establishBaseline()` baseline-event
gap (described above) was fixed, so the test was corrected to expect the real baseline event.

**Pre-existing flaky tests fixed** (found blocking this phase's own required `verify:push` run,
confirmed via isolated re-runs to be a real 5000ms-timeout-under-full-suite-load issue, not a
logic defect — same class already fixed for the Phase 11 retention test in PR #87): raised
`{ timeout: 20_000 }` on `audit-report-signals.integration.test.ts`'s one real-network test and on
the three `public-status.integration.test.ts` tests that each create their own fresh D1 harness.

## Deployment

Not yet deployed as of this report. Requires explicit, in-the-moment approval per this repo's
standing rule, requested separately after merge.

## Deferred work

- **Phase 9** (Agency Workspace and Portfolio Workflows): agency portfolio dashboards, team roles,
  client workspaces — none introduced here, matching this phase's own prohibited-changes list.
- **Phase 10** (Notification Channels and Monitoring Reliability): no new notification channel or
  monitoring-frequency change was made.
- **Unscheduled** (RISK-034): `listDomains()`'s pre-existing `openFindingsCountFor` N+1 pattern —
  found, documented, deliberately not fixed in this pass to keep the change surface focused.
- **Unscheduled**: SRS §2.3 Primary Tagline reconciliation (RISK-028) and the 10 missing
  `package.json` description fields — named in the roadmap's original Phase 8 objective text but
  out of scope for the actual detailed execution prompt this phase was run against; recorded
  explicitly in the roadmap rather than silently claimed complete or silently dropped.

## Runtime impact

Phase 8 improves CrawlPact's authenticated saved-domain list, current policy summary, change
attribution, policy-change timeline, scan comparison, finding lifecycle, monitoring presentation,
manual-rescan experience, scan history, and retention messaging. It preserves existing crawler
classifications, crawler-registry governance, audit semantics, pricing, plan limits, Paddle
configuration, monitoring frequencies, notification channels, authentication model, and public
trust requirements.

## Next phase

Phase 9 (Agency Workspace and Portfolio Workflows) can begin once this phase is merged and
deployed. Verified inputs it can rely on: the `domain_change_events` table and its full
attribution/timeline/comparison/finding-lifecycle model (stable, versioned, safe to build a
portfolio view on top of); the real duplicate-scan lock (`scan_lock_until`) any future
multi-domain bulk-action feature must respect; the corrected `computePolicySummary` monitoring
field; and the now-real `nextScanAt` UI precedent for surfacing scheduling state.
