# Scan History and Retention UX

## Scan history

`GET /api/domains/:domainId/scans?cursor=&status=&trigger=` — replaces the current unpaginated,
20-row-capped inline list in `[domainId].astro` with a real bounded, filterable, paginated view.

- Columns: scan timestamp, trigger type (`baseline | manual | scheduled | admin` — mapped from the
  existing `triggeredBy` enum, `admin` scans are the existing `triggeredBy: "admin"` value used by
  Super Admin re-scans), completion state, score, registry version, change detected (yes/no, from
  whether a `domain_change_events` row references this scan as its `current_scan_id`), comparison
  availability (a link, disabled with a reason when the scan isn't comparable to its predecessor),
  report link.
- **Fixes messaging-audit item C3**: the `StatusChip` here reuses `AuditReportView.tsx`'s existing
  `STATUS_LABEL`/`STATUS_TONE` maps (imported, not duplicated) instead of rendering the raw
  `scans.status` enum string (`"completed_with_warnings"`) as literal UI text.
- Filters: All, Manual, Scheduled, Successful, Partial, Failed, Change detected, No material
  change — applied server-side in the SQL `WHERE` clause, not client-side over a fetched page.
- Pagination: cursor-based (`startedAt`+`id`), default page size 20 (matching the existing cap,
  now a page size instead of a hard ceiling), server-side.

## Retention boundary

Every scan-history and timeline response includes a `retentionBoundary` object:
`{ retentionDays, oldestRetainedScanAt, hasExpiredHistory }`, computed from the domain owner's
`plan.historyRetentionDays` and the oldest surviving `scans.startedAt` for that domain (a plan
change takes effect on the _next_ retention sweep, per existing `purgeExpiredDomainScans()`
behaviour — Phase 8 does not change when purges run, only surfaces their result honestly).

Exact copy, matching the Phase 8 prompt's required wording:

- Normal: _"This account retains domain audit history for {N} months under the {Plan} plan."_
  ({N} derived by dividing `historyRetentionDays` by 30 and rounding to the nearest whole month
  for display only — the stored value and all comparisons remain in days).
- Expired-row reference: _"Earlier scan details are outside the retained history for this
  account."_
- Retention-aware no-change copy (never "no changes ever"): _"No material policy change was
  detected within the available retained history."_

Never used unless literally true: "Full history", "Permanent history", "Unlimited history",
"CrawlPact has never seen an earlier change" — checked by a dedicated grep-based test
(`apps/web/tests/unit/scan-history-copy.test.ts`) against every new copy string added in this
phase, mirroring the pattern already established by `scripts/status-validate.mjs` for the
status/changelog trust correction.

## Plan-change behaviour

No new deletion behaviour is introduced when a plan changes — retention continues to follow
`purgeExpiredDomainScans()`'s existing plan-tier logic exactly as before Phase 8. This document
records that explicitly so the retention-boundary UI's honesty claim ("outside the retained
history", not "deleted the moment your plan changed") stays true to the real system behaviour.
