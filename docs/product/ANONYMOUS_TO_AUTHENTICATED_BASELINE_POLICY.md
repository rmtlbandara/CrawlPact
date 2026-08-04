# Anonymous-to-Authenticated Baseline Policy

**Level 1 document (Current authoritative).** Defines exactly when a newly-saved domain adopts an
existing anonymous scan versus reruns a fresh one, and how that decision is made safely,
idempotently, and transparently. Established Phase 5, 2026-08-04. Implementation:
`apps/web/src/lib/audit-continuation.ts` (`decideBaselineStrategy` and `establishBaseline`).

## Why adoption is implemented as a claim, not a copy

`docs/product/PHASE_05_EXISTING_CONVERSION_FLOW_BASELINE.md` §3 established that saving a domain
today always triggers a brand-new scan — there is no existing path that reuses an anonymous scan's
already-computed data. Two implementation shapes were considered:

- **Duplicate the scan row** — `INSERT` a new `scans` row copying the anonymous scan's
  already-computed report fields, owned by the new domain. Rejected: this duplicates the report
  payload (explicitly prohibited by the Phase 5 prompt's performance requirements — "avoid
  duplicating the report payload"), doubles storage for no benefit, and creates two independent
  rows that could technically diverge later (e.g. one purged, one not).
- **Claim the existing row** (chosen) — a single, idempotency-guarded `UPDATE`:
  ```sql
  UPDATE scans
  SET domain_id = ?, triggered_by = 'user', triggered_by_user_id = ?
  WHERE id = ? AND domain_id IS NULL
  ```
  followed by the existing `recordScanOnDomain(db, domainId, { scanId, score, nextScanAt })`
  helper (already used by the manual re-scan endpoint — reused here unchanged, not duplicated).
  This is the same scan row, now owned. It automatically stops being eligible for
  `purgeAnonymousScans()` (which only ever targets `domainId IS NULL` rows), so it falls under the
  owning plan's normal `history_retention_days` window from the moment it's claimed — no separate
  retention rule needed. The `WHERE domain_id IS NULL` guard makes the claim atomically safe under
  concurrent attempts: whichever request's `UPDATE` runs first wins (affects 1 row); any later
  attempt affects 0 rows and the caller falls through to Approach B (rerun) automatically. This
  also naturally implements SRS-adjacent §15's "domain saved by another account" requirement: if
  account A already claimed scan X for their own domain, account B's later attempt to convert the
  same anonymous report harmlessly reruns a fresh scan for B's own domain, with zero visibility
  into A's account.

## Approach A — Adopt the anonymous scan

All of the following must hold, checked in this order, entirely server-side:

1. The continuation record itself is valid, unexpired, and unconsumed (see the threat review
   document for the continuation mechanism itself).
2. The referenced `scans` row still exists (not yet purged by `purgeAnonymousScans()`).
3. `scans.status` is a genuine success state (`"completed"` or `"completed_with_warnings"` — never
   adopts a `"failed"`/`"engine_disabled"`/other non-terminal status).
4. `scans.registryVersionId` and `scans.rulesetVersionId` match the currently-active registry and
   ruleset versions (a stale scan against a superseded registry is not silently presented as
   current).
5. The claiming `UPDATE ... WHERE domain_id IS NULL` actually affects a row (handles the
   concurrent/already-claimed-elsewhere race described above).

If all five hold: the domain is saved with `lastScanId` pointing at the claimed scan, and the UI
tells the user explicitly: _"Your saved baseline uses the report you already reviewed, from
{scanDate}."_ The earlier timestamp is always shown — never silently presented as "just scanned."

## Approach B — Rerun under the authenticated account

Used whenever any Approach-A condition fails — including simply because a continuation was never
present (e.g. a user signs up independently and saves a domain with no prior anonymous audit at
all; the domain-save-without-a-continuation path was already the case before Phase 5 and is
unchanged). The rerun reuses the exact same `runAudit()`/`persistScan()`/`recordScanOnDomain()`
functions already used by the manual re-scan endpoint (`POST /api/domains/:domainId/scan`) — no
new scanner logic, no new scoring logic. The UI says explicitly: _"CrawlPact is rerunning the
audit to establish your saved baseline."_ — never silently swaps the report shown without saying
so.

## Idempotency and transaction integrity

- The claim `UPDATE` and the domain `UPDATE` happen inside the same request; if the domain insert
  itself fails, no claim is attempted (nothing to roll back).
- A repeated handoff request for the same continuation is idempotent: the continuation's own
  `consumedAt` guard (see the threat review) prevents a second domain from ever being created from
  the same continuation, independent of the scan-claim's own `WHERE domain_id IS NULL` guard —
  two independent idempotency layers, not one.
- If baseline establishment fails partway (e.g. the rerun's scan itself fails), the domain row is
  never left in a state where `monitoringState = "active"` but no scan has ever succeeded for it —
  monitoring is not claimed/enabled until a real baseline (adopted or rerun) exists. A failed
  rerun leaves the domain saved (per §7's "save the domain even if scan cannot complete" allowance)
  but with `lastScanId` unset, exactly matching the pre-Phase-5 empty state already shown by
  `/app/domains/[domainId].astro` for a domain with no scans yet.
- Registry version is always recorded on the resulting scan row (already a required field on
  `scans`, unchanged) regardless of adopt vs. rerun.

## What is explicitly not built here

Per the Phase 5 prompt's scope boundary, this policy does **not** attempt to reconcile
`registryVersionId` drift by re-evaluating an old scan's raw evidence against a newer registry
without a fresh fetch (that would be a third, more complex strategy not required by the prompt,
and risks becoming a second evaluation engine) — a registry-version mismatch always routes to
Approach B, full stop.
