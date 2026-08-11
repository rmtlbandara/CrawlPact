---
Document owner: Engineering owner
Status: current-authoritative
Last verified: 2026-08-11
---

# Registry Rollback Runbook

## When to roll back

A published release is producing materially incorrect evaluations (Section 187's bad-release
response procedure):

1. Confirm the issue — a real, reproducible incorrect evaluation, not a one-off scan anomaly.
2. Determine the safe previous release (usually, but not necessarily, the immediately-prior
   active one).
3. `POST /api/admin/registry/releases/:targetVersionId/rollback` with a reason.
4. The response reports `domainsScheduledForReEvaluation` — Phase 15 fix: rollback now computes
   the same semantic diff and schedules the same bounded re-evaluation as a forward publish
   (previously it only moved the pointer and left domains evaluated against the superseded state
   indefinitely — see `docs/registry/PHASE_15_REGISTRY_BASELINE.md`).
5. Preserve the bad release historically — never delete it, never edit it
   (`rollbackRegistryVersion` only ever changes `is_active`; `registry_version_entries` for the
   bad release are untouched).
6. Publish a public correction if the bad release was customer-impacting (via the normal
   changelog, describing what was wrong and that it was reverted).
7. Add a regression test proving the specific bad classification, then create a corrected release
   through the normal publication runbook. **Never edit the bad historical release to "fix" it.**

## Guarantees

- **Cannot activate an unpublished draft.** `rollbackRegistryVersion` checks `target.publishedAt`
  and throws if the target was never published — Section 145's "an unpublished draft must not
  become active through rollback" is enforced in code, not just by convention.
- **Atomic.** The deactivate-old/activate-new/record-history sequence is one `db.batch()` — there
  is never a window with zero active releases.
- **Idempotent.** Rolling back to the already-active release is a harmless no-op
  (`{ alreadyActive: true }`, no duplicate activation-history row, no duplicate re-evaluation
  scheduling).
- **History preserved, not deleted.** Public history shows the release's original publication and
  its later activation-status changes as separate facts
  (`registry_version_activations` — Section 68) — publication dates are never rewritten.

## Rollback readiness verification

Before _any_ forward publish, the previous release is implicitly rollback-ready — it is already
published, and `rollbackRegistryVersion` requires nothing more than that. There is no separate
"prepare rollback" step to forget (Section 200) as long as the prior release was published through
the normal runbook.
