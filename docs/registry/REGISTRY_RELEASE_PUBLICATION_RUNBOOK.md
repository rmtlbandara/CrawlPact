---
Document owner: Engineering owner
Status: current-authoritative
Last verified: 2026-08-11
---

# Registry Release Publication Runbook

Operational steps for publishing a new crawler registry release (Section 197's production
deployment order, expanded).

## Two separate approvals

**Application deployment approval** authorises deploying Phase 15's code/migrations. **Registry
activation approval** authorises the actual new active registry release. These are never the same
approval — the application can (and should, when practical) be deployed before any new registry
release is activated, so the hardening ships and is verified against the _existing_ active
release before any new classification goes live.

## Steps

1. **Reverify** every crawler whose classification is expected to change
   (`docs/registry/PHASE_15_FULL_SOURCE_REVERIFICATION_REPORT.md` for this phase's baseline pass;
   future releases repeat the same live-research discipline).
2. **Review stale sources** — check `pnpm registry:validate`'s stale-review warnings.
3. **Create the candidate**: `POST /api/admin/registry/releases` with a version label
   (`docs/registry/REGISTRY_VERSIONING_POLICY.md`) and mandatory release notes.
4. **Validate**: `GET /api/admin/registry/releases/compare?from=<active>&to=<candidate>` runs
   `validateReleaseCandidate` and `computeSemanticDiff` together. Resolve every blocking error
   before continuing; note but don't necessarily resolve every warning.
5. **Review impact**: the same response shows crawlers added/removed/changed (split by
   evaluation-semantic vs. evidence vs. editorial), the candidate checksum, and the estimated
   affected-domain count.
6. **Prepare rollback readiness**: confirm the _current_ active release id — that is
   automatically the rollback target if anything goes wrong (Section 200; no separate action
   needed, since rollback only requires a previously-_published_ release, which the current active
   one always is).
7. **Obtain explicit registry-release approval** — a human decision, separate from any code
   deployment approval, per the standing rule that production data changes require in-the-moment
   permission.
8. **Publish**: `POST /api/admin/registry/releases/:id/publish` with a reason. This
   (`publishRegistryVersion`) atomically re-validates, computes and stores the checksum, flips the
   active pointer, and records an activation-history row — all in one `db.batch()`.
9. **Verify**: confirm exactly one active release, the correct version label, the checksum
   matches `registry:checksum:verify`, and that `domainsScheduledForReEvaluation` in the publish
   response matches the impact preview's estimate.
10. **Verify public surfaces**: the crawler directory and `/changelog` should reflect the new
    release within their documented cache TTL (see
    `docs/registry/PUBLIC_REGISTRY_RENDERING_ARCHITECTURE.md`).
11. **Observe**: watch scan failures, policy-result anomalies, and re-evaluation backlog for the
    hours following publication (Section 201) — do not infer correctness from HTTP 200 alone.

## Idempotency note

Re-running `publish` against an already-active release is a harmless no-op
(`publishRegistryVersion` returns `{ alreadyActive: true }` and skips the pointer flip, checksum
recompute persistence, and activation-history insert) — safe to retry after a network error
without risking duplicate activation-history rows or duplicate re-evaluation scheduling.
