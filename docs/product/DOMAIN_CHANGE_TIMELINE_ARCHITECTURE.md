# Domain Change-Timeline Architecture

## Decision: materialise immutable events (Option B)

A new table, `domain_change_events`, is populated at the moment a meaningful event occurs
(successful scan comparison, preset change), rather than deriving the timeline on every read from
`scans` + `scan_diffs` + `findings` + registry versions.

### Why not derive on read (Option A)

- RISK-008 (Workers Free CPU budget, `docs/risks/ACTIVE_RISKS.md`) already constrains query cost
  for this codebase's scheduled sweep; a timeline page that re-joins `scans`/`scan_resources`/
  `findings`/`registry_versions` on every page view for potentially years of history multiplies
  that same cost on the read path instead.
- Historical interpretation would shift under users: if `change-attribution.ts` v2 ships with a
  smarter rule, every past page load would silently re-narrate old changes differently — a direct
  violation of this phase's own "changing the objective must not change historical evidence" and
  general anti-fabrication posture. A stored `model_version` plus an immutable row is the only way
  to guarantee a 2026-08 change is still described the same way in 2027.
- `scan_diffs` (write-only today, confirmed in the baseline doc) is unbounded by plan-tier
  retention already (a known Phase 11 open item) — deriving yet another read path over it doesn't
  fix that, it just adds more expensive queries against the same ungoverned growth.

### Why materialised events are safe here

- One row per meaningful event (not per scan) — a domain scanned weekly for a year without any
  material change produces roughly zero new rows, not 52.
- Pagination becomes a plain indexed `WHERE domain_id = ? ORDER BY observed_at DESC LIMIT ?
OFFSET ?` — no joins on the read path at all.
- Idempotency is enforceable with a real unique constraint (see event model doc), which a
  derived-on-read approach cannot offer the same guarantee for under retry/replay.

## Generation

- **Scheduled monitoring**: `runMonitoringSweep()` → `handleScanSuccess()`
  (`apps/web/src/lib/monitoring.ts`) already computes `computeScanDrift()` after every successful
  scan with a prior scan to compare against. A new call, `generateTimelineEvent()`
  (`apps/web/src/lib/domain-timeline.ts`), runs immediately after — wrapped in `try/catch` so a
  timeline-generation failure never blocks scan completion, monitoring status, or the existing
  notification path (Phase 8 prompt §58/§60: "Timeline failure must not block scan completion or
  monitoring status").
- **Manual rescan**: `POST /api/domains/:domainId/scan`
  (`apps/web/src/pages/api/domains/[domainId]/scan.ts`) currently has no drift/diff step at all —
  it only calls `recordScanOnDomain()`. This phase adds the same `computeScanDrift` +
  `generateTimelineEvent()` call here too, so a manually triggered change is captured exactly like
  a scheduled one (the Phase 8 prompt requires the timeline to include "Manual rescan resulting in
  a meaningful change").
- **Preset change**: `updateDomain()` (`apps/web/src/lib/domains.ts`) gains a diff check — when
  the patch actually changes `preset` from its previous value, a `preset_changed` operational
  event is generated inline (not scan-triggered, so it needs no `try/catch` isolation from a scan
  pipeline — a domain-settings mutation failure already surfaces as an API error today, and this
  event write participates in the same request).
- **First-successful-scan baseline**: when `domain.lastScanId` was previously `null` and a scan
  now succeeds, `generateTimelineEvent()` writes a `baseline` event instead of running attribution
  (there is nothing to compare against).

## Idempotency

Every generated event carries a deterministic `fingerprint` (see event model doc) and the insert
uses `onConflictDoNothing()` against a unique index on `fingerprint` — a retried scheduled sweep,
a replayed webhook-adjacent job, or a duplicate manual-scan race can never produce two rows for
the same logical event.

## Pagination

`listDomainChangeEvents(db, domainId, {limit, cursor})` — server-side, bounded, cursor is the last
row's `(observed_at, id)` pair (stable ordering even with same-timestamp ties). Default page size
20, hard cap 50 per the Phase 11 query-and-performance conventions used elsewhere in this
codebase.

## Retention

Timeline retention follows the same plan-tier `historyRetentionDays` the underlying scans already
use (`apps/web/src/lib/data-retention.ts`). `domain_change_events.current_scan_id` is nullable
with `ON DELETE SET NULL` (matching `scan_diffs`'s Phase 11 fix) so a purged scan does not corrupt
the timeline row — the event's own `summary`/`affected_purposes_json`/`finding_counts_json` are
self-contained and remain meaningful without the underlying scan. `purgeExpiredDomainScans()`
(`apps/web/src/lib/data-retention.ts`) gains a companion `purgeExpiredDomainChangeEvents()` step
run in the same retention pass, deleting `domain_change_events` rows older than the _domain's own
plan's_ retention window — this is a deliberate design choice: unlike `scan_diffs` (a known,
already-flagged-as-unbounded Phase 11 open item, RISK-006/RISK-007 lineage), the new table does
not repeat that gap.

## No public exposure

`domain_change_events` is read only through authenticated, ownership-checked routes
(`/api/domains/:domainId/timeline`, `/app/domains/:domainId`). No public API, no public route, no
inclusion in the sitemap. See the threat-review document for authorisation test coverage.
