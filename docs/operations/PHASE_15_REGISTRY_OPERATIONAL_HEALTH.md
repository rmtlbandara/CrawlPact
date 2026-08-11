---
Document owner: Engineering owner
Status: current-authoritative
Last verified: 2026-08-11
---

# Phase 15 — Registry Operational Health

Integrates registry integrity into the Phase 14 `/admin/operations` surface (Section 125),
without adding registry internals to public `/status` (Section 126).

## What's exposed internally

`apps/web/src/lib/admin/registry-health.ts`'s `getRegistryHealth(db)` — a read-only check,
composed into `getOperationsSummary` (`apps/web/src/lib/admin/operations.ts`) and rendered in a
new "Registry health" section on `/admin/operations`:

- Active release version label (or "None active" — itself a real, alarming signal if seen).
- Whether the stored checksum matches a fresh recomputation (§124's "checksum valid" check).
- Count of evaluation-eligible crawlers whose source review is overdue (>180 days,
  `docs/registry/REGISTRY_REVERIFICATION_POLICY.md`).
- Count of `active`-lifecycle entries in the release snapshot with no `lastVerifiedAt` (should
  always be zero — `validateReleaseCandidate` is supposed to block these at publish time; a
  non-zero count here would mean that guard was bypassed somehow, e.g. by a direct DB write).
- Duplicate evaluation-eligible tokens (should also always be zero for the same reason).
- Whether the active release's entries parsed cleanly and whether an active ruleset exists.

## Why this stays internal, not public

A stale source-review queue is explicitly _not_ a public outage (Section 126) — it means "a human
should double-check this crawler's documentation soon," not "audits are wrong right now." The
only registry condition that could ever justify surfacing through public `/status`'s `Audit and
scanner` component is a **corrupted or invalid active registry actually producing incorrect
audits** — e.g. `entriesParseCleanly: false` or `checksumValid: false` persisting, which would
mean every subsequent scan is silently using bad/tampered data. This phase does not wire that
escalation path automatically; it requires real observed customer impact evidence first (Phase 14's
own "use real impact evidence" discipline), which this phase has no occurrence of to act on.

## Re-evaluation backlog (Section 127)

Not built as a dedicated metrics table this phase. The existing re-evaluation mechanism
(`scheduleReEvaluation` moving `domains.next_scan_at` into the past, picked up by the existing
monitoring sweep) has no separate "pending registry re-evaluation" queue to track — it reuses the
sweep's own existing due/overdue accounting, already visible in `getOperationalCapacitySnapshot`'s
`monitoring.dueNowCount`/`longOverdueActiveDomainCount` (Phase 11/14). A registry-driven
re-evaluation is indistinguishable, by design, from any other reason a domain became due — adding
a parallel "registry re-evaluation backlog" counter would require tagging _why_ a domain became
due, which the current schema doesn't do and which this phase judged unnecessary complexity for
the actual operational question ("is the sweep keeping up?", already answered).

## Disaster recovery

See `docs/operations/DISASTER_RECOVERY_RUNBOOK.md`, extended this phase with a registry section
covering: active release invalid, accidental bad activation, checksum mismatch, incorrect
classification, and failed activation/rollback — each resolving to the same procedure:
`docs/registry/REGISTRY_ROLLBACK_RUNBOOK.md`.
