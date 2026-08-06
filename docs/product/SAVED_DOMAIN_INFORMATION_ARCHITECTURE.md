# Saved-Domain Information Architecture

## Saved-domain list (`/app/domains`)

Kept as a React island (`DomainsManager.tsx`) fed by `GET /api/domains`, extended rather than
replaced:

- **New**: a plan-limit indicator ("X of Y saved domains used", reading `plan.savedDomainLimit`
  vs. the returned row count — both already available server-side, no new query).
- **New**: a "Recent change" column/value per domain, sourced from each domain's latest
  `domain_change_events` row (one extra bounded query: `SELECT ... WHERE domain_id IN (...)
ORDER BY observed_at DESC` per domain, capped at the account's own domain count which is itself
  capped at 100 by plan — no unbounded fan-out).
- **New**: monitoring state rendered as a `StatusChip` (tone + text label), not a bare underlined
  link — text label always present, colour never the only signal.
- **New**: a loading skeleton (`DataTable`'s own built-in skeleton, now actually wired via
  `isLoading`) instead of a blank flash.
- **Changed**: sorting added for "Last scan" and "Recent change" (client-side `Array.prototype
.sort`, since the full row set is already in memory and is small — see pagination decision
  below).
- **Unchanged**: existing filters (group, monitoring state, score band, open-findings-only) and
  the existing search-by-domain-name filter already present in `DomainsManager.tsx`.

### Pagination: deliberately not added to the list itself

`savedDomainLimit` hard-caps every account at 100 rows (Agency plan, the highest tier). A
fully-loaded 100-row table with no timeline/evidence payload attached (the new "recent change"
column is one short summary string, not the full event) is not the "load all account domains and
all scan histories into one response" anti-pattern the Phase 8 prompt warns against — that warning
is really about _scan histories_ (unbounded per domain, addressed below) and about _timeline
detail_ (addressed by the timeline's own real pagination). Adding fake pagination controls to an
inherently ≤100-row list would be premature complexity with no real query-cost benefit; this
decision is recorded here rather than silently assumed so a future reviewer can see it was
considered, not skipped.

## Saved-domain detail (`/app/domains/:domainId`)

Final section order (per Phase 8 prompt §10, no evidence found during baseline research to
justify deviating from the suggested order):

1. **Domain header and primary actions** — display name, canonical origin, last successful scan,
   monitoring badge, baseline date; actions: Run manual rescan, View current report, Share report,
   Print report, Manage monitoring, Domain settings (only actions that actually exist/are
   authorised are shown — no "Domain ownership verified"/"Protected"/"AI-safe"/"Fully blocked"
   wording anywhere, matching the prompt's explicit prohibited-copy list).
2. **Current policy summary** — `computePolicySummary()` reused from the latest completed scan's
   `AuditReportResponse` (fixing the `monitoring: "Not enabled"` hardcode bug found in baseline
   research: the domain detail page now passes the domain's real `monitoringState` in, so
   `computePolicySummary` gets a new optional second parameter for this one case rather than the
   function guessing).
3. **What changed** — one concise sentence derived from the most recent `domain_change_events`
   row (see the attribution model's example copy), linking into the timeline.
4. **Monitoring status** — see `MONITORING_STATUS_UX_MODEL.md`.
5. **Policy-change timeline** — paginated `domain_change_events` list.
6. **Current findings and recommendations** — reused from the existing report-rendering
   components (`AuditReportView.tsx`'s findings section), not duplicated.
7. **Crawler-purpose detail** — reused crawler-matrix rendering, filtered to affected purposes when
   viewing a specific timeline event.
8. **Current evidence** — the latest scan's `scan_resources`, reusing the same escaping/bounded
   presentation as the comparison view.
9. **Scan history** — see `SCAN_HISTORY_AND_RETENTION_UX.md`.
10. **Sharing, printing, and report actions** — surfaces the existing `sharing.ts`/print
    capability (previously only reachable from `/audit/:auditId`) directly from the domain page.
11. **Domain settings and retention information** — preset, notes, monitoring toggle (existing
    `DomainDetailActions` fields, kept), retention-boundary messaging, domain deletion.

Rationale for "current state before historical detail" (Phase 8 principle §6.1): sections 2-3
render above the fold from server-rendered data already fetched for the page (the domain row +
its latest scan), so a user sees the current policy meaning before any client-side timeline fetch
resolves — no interpretation of raw report data is required first.

## Empty/loading/error states

Reuses the shared `EmptyState`/`ErrorState` primitives (`packages/ui/src/components/`) already
used elsewhere in this codebase, with copy exactly matching the Phase 8 prompt's §32/§33 required
strings (no material change / baseline pending / history expired / comparison unavailable /
monitoring disabled / partial scan / failed scan), so the vocabulary stays consistent with the
public status-page trust-correction work rather than introducing a third, competing tone.
