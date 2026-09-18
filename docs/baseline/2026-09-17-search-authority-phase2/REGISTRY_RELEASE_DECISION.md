---
Document owner: Engineering owner
Status: current-authoritative (Phase 2, §12 — registry release decision)
---

# Registry Release Decision — 2026-09-17

Phase 2 §12 asks whether the registry-authority story (the basis for search-authority content
like "AI Crawler Registry Landscape") needs a fresh governed release before content built on top
of it is published, so the content doesn't cite a release that's already stale.

## Current state (re-confirmed live this pass)

- Active published release: `2026.07.3` (published 2026-07-28), 23 crawlers, 9 operators.
- `crw_applebot` was added to master `crawlers` data during Phase 1 (2026-09-17) after live
  vendor-doc research found Apple's own documentation describing the base Applebot feeding
  context to AI-generated output — a genuine, evidence-backed gap. It has never been part of any
  published release.
- No other master-data change has accumulated since Phase 1 closed (single-crawler diff: `+1`
  vs. the published release).

## Decision

**Recommend publishing a new release** (e.g. `2026.09.1`) carrying the existing 23 crawlers plus
`Applebot`, with a changelog entry citing the Apple source
(`https://support.apple.com/en-us/119829`) already documented in Phase 1's
`CRAWLER_REGISTRY_FRESHNESS_AUDIT.md`. Reasons:

1. Phase 2's registry-authority content (comparison pages, the research publication previewed in
   `RESEARCH_PUBLICATION_EVIDENCE.md`, any "24 crawlers across 9 operators" claim) should describe
   the **live, in-effect** registry, not a registry that has a known, dated, evidence-backed gap
   sitting unpublished. Publishing first means every subsequent content claim is accurate at
   publication time without a footnote explaining a pending change.
2. The change is minimal and low-risk: one addition, no removals, no reclassifications — the
   lowest-risk kind of release this governance model is designed for.
3. Waiting doesn't reduce risk here — the underlying evidence (`last_verified_at: 2026-09-17`) is
   already collected and will not improve by delaying.

## Why this pass does not publish it directly

Publishing a registry release is a governed, audited action
(`registry_versions`/`registry_version_entries` rows, a computed content checksum,
`approved_by_user_id` and `published_by_user_id` foreign keys to a real `users` row) performed
through the Super Admin `/admin/registry/releases` workflow against a live authenticated session.
This mirrors the Production-deploy gate already established and accepted in Phase 1: this pass
can independently verify the underlying data and prepare the exact recommendation, but must not
fabricate the audit trail by writing `registry_versions`/`registry_version_entries` rows directly
via a migration or raw D1 write with a synthetic `approved_by_user_id` — doing so would defeat the
entire purpose of that governance model (real accountability for what release is live and who
approved it), which is exactly the failure mode `docs/registry/
PHASE_00_18_REGISTRY_IMMUTABILITY_FIX.md` was written to prevent.

## Concrete next step (owner action required)

Sign in to `/admin/registry/releases` as a Super Admin and publish a release with:

- Version label: `2026.09.1` (or the next appropriate label per existing convention).
- Contents: the current 23 crawlers + `Applebot` (24 total).
- Changelog: "Added Applebot (base) — Apple's own documentation
  (https://support.apple.com/en-us/119829) now describes it feeding live context to AI-generated
  output in Apple products, distinct from Applebot-Extended's training role. Verified
  2026-09-17."

Once published, this pass (or a continuation of it) should re-verify the release live (crawler
count, operator count, checksum) and update any Phase 2 content that cites registry counts to
match, then re-run `pnpm registry:public:validate` to confirm the public-facing crawler pages
stay consistent with the new release.
