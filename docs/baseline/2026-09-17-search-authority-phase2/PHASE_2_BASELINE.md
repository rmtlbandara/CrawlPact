---
Document owner: Engineering owner
Status: current-authoritative (Phase 2 — opening baseline)
---

# Phase 2 Opening Baseline — 2026-09-17

Recorded before any Phase 2 content/registry/research work began, so later sections have a fixed
reference point.

## Repository state

- `main`: `f1b3089` ("docs(phase1): Production deployment validated live — PASS, PHASE 1
  COMPLETE", PR #203, merged after PR #202). Working tree clean at the start of this phase.
- Post-merge CI for `f1b3089` was `in_progress` at last check during Phase 1 close-out; not
  re-checked yet this pass (not blocking Phase 2's read-only/prep work).

## Time / data-availability gate

- Current time: `2026-09-17T10:44:13Z` (approx.; re-derived from D1 query timings this pass).
- The `growth_collection` scheduled job (GSC/GA4/CrUX) has **not yet executed a single time** in
  Production — first real tick is `2026-09-18 03:00 UTC`. Every Phase 2 section that depends on
  real search-console query/impression/click data (§2 existing-page wins, §7-8 opportunity
  sizing) is genuinely blocked until then, not by any code defect. This matches
  `PRODUCTION_VALIDATION.md`'s and `PHASE_1_COMPLETION_REPORT.md`'s own recorded state — re-
  confirmed here rather than assumed carried-forward.

## Crawler registry state (re-confirmed live, not assumed from Phase 1 docs)

Live D1 queries against production this pass:

- Active published release: `2026.07.3`, 23 crawlers, **9 operators**, 1 total published release
  ever (`total_published_releases: 1` — this would be the second release if published).
- Purpose distribution across the 23 published crawlers: `search: 7, training: 5,
user_triggered: 4, agent: 2, advertising_validation: 2, unknown: 1, research: 1, mixed: 1`
  (sums to 23).
- Verification health of the published release: `total: 23, eligible: 23, verified: 23,
review_due: 0` — every governed crawler in the live release is currently verified and none is
  past its review-due threshold (180 days). This is a real, positive, reproducible finding, not
  an assumption carried from Phase 1's freshness audit — it was re-queried directly this pass.
- `crw_applebot` exists in master `crawlers` data (added in Phase 1, `last_verified_at:
2026-09-17`) but belongs to **zero** published releases — unchanged since Phase 1 close-out.

## What this baseline enables this pass

Per Phase 2's own instruction not to sit idle while GSC-dependent sections are blocked, this pass
proceeds with the sections that only need registry/content data already available:

- §12 registry release decision → see `REGISTRY_RELEASE_DECISION.md`.
- §15-16 first research publication readiness → see `RESEARCH_PUBLICATION_EVIDENCE.md`.
- A real content inventory of existing pages (§7 prep) — next in this pass.

GSC/GA4-dependent sections (§2, §7-8 opportunity sizing, §9 measurement baselines) are deferred
until after 2026-09-18 03:00 UTC, and will be picked up as a continuation of this same phase, not
treated as a separate phase.
