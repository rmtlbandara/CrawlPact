# Domain Timeline Backfill Policy

## Decision: Option A — no historical backfill

The timeline begins when Phase 8 deploys. Existing scan history remains fully available in its
own "Scan history" section (already shipped, `listScansForDomain()`), unaffected by this decision
— no data is hidden, only the _new_ timeline-event rows are not retroactively generated for scans
that happened before this phase existed.

## Why not Option B/C (bounded or complete backfill)

- **Attribution correctness is not established for old scans.** `change-attribution.ts` depends
  on `scan_resources.resourceHash` being populated per resource type. That column was added and
  started being populated by Phase 11 "for future change-detection use" — scans from before that
  point may have partial or absent resource-hash data, which under the attribution model's own
  rules must resolve to `uncertain`, not a fabricated `website_policy`/`registry_driven` verdict.
  A bulk backfill over old scans would therefore either produce a page mostly full of `uncertain`
  rows (low value) or risk quietly relying on incomplete data (a real trust risk the whole point
  of this phase is to avoid).
- **Cost is not yet measured.** No production measurement of how many domain/scan pairs would
  need processing, nor of the D1 read/write cost per pair, has been taken — Option C's own gate
  explicitly requires "D1 cost is acceptable" and "correctness is proven" before it may be used,
  and neither condition is met.
- **Simplicity and honesty.** A domain with a long scan history gets an honest "This is the first
  saved baseline [for the timeline]" framing at the moment Phase 8 ships, plus full access to its
  pre-existing scan history and reports exactly as before — nothing is fabricated or silently
  reinterpreted.

## What happens for an existing domain on deploy

- The **next** successful scan after deployment for a domain with 0 prior `domain_change_events`
  rows and a non-null `lastScanId` gets a `baseline` event (see architecture doc — "no previous
  scan" triggers `baseline` in the attribution model; effectively Phase 8 treats "no prior
  _timeline_ event" the same as "no prior scan" for the purpose of the very first row it ever
  writes for that domain, since there is nothing correctness-established to compare against).
  Existing scan history remains visible under Scan history for genuine older comparison via the
  existing per-report links.
- Domains with monitoring already active continue to scan on their existing schedule; nothing
  about scan cadence, quota, or scheduling changes because of this decision.

## Revisiting this decision

If a future phase wants Option B, it must be requested and approved separately, with real D1 cost
measurement and an explicit acceptance of `uncertain`-heavy output for pre-resource-hash scans —
this document is the record of why that bar was not met at Phase 8 time, not a permanent
prohibition.
