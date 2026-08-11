# Phase 16 research operations runbook

Scope: the Registry Observatory and research-publication workspace actually shipped this phase.
There is no background research job, so most of the scenarios the Phase 16 prompt anticipates
(§178 — stuck run, high failure rate, capacity issue) don't yet apply; this runbook covers what
_can_ actually go wrong today.

## A draft won't generate

`generateRegistryLandscapeDraft` throws if no active registry release exists at all. This should be
structurally impossible in a healthy environment (`pnpm registry:integrity:verify` asserts exactly
one active release) — if it happens, treat it as a registry-integrity incident first, not a
research-specific one; see `docs/registry/PHASE_15_REGISTRY_GOVERNANCE_THREAT_REVIEW.md`'s
equivalent guidance.

## Submit-for-review keeps failing validation

`submitResearchPublicationForReview` returns (does not throw) a `ResearchPublicationValidationResult`
with populated `errors`. The admin UI (`ResearchManager.tsx`) surfaces these directly. Common
causes: the active registry release has zero evaluation-eligible crawlers (denominator-zero
findings trigger only a warning, not an error, so this alone shouldn't block); a future edit to
`buildRegistryLandscapeContent` accidentally introduces text matching `BANNED_CLAIM_PATTERNS` — fix
the wording, not the validator.

## A publish attempt fails with a checksum mismatch

`publishResearchPublication` refuses to publish if the checksum recomputed at publish time doesn't
match what was stored when the draft was created. This should never happen through normal use (no
code path mutates `content_json` between draft creation and publish) — if it does, do not force a
publish; investigate for a direct database edit or a genuine bug in `getChecksumSubset`/
`computePublicationChecksum` first.

## A correction is refused ("no longer the active release")

Expected behaviour, not a bug: `correctResearchPublication` only recomputes from the exact release
a publication was originally pinned to. If the registry has since moved to a new active release,
publish a new, separate publication instead of trying to correct the old one — see
`docs/research/RESEARCH_CORRECTION_AND_RETRACTION_POLICY.md`.

## Bad publication already live

Use `withdrawResearchPublication` with a clear reason, or `correctResearchPublication` if the
pinned release is still active and the fix is a genuine computation bug. Never edit
`research_publications` directly in production D1.

## Crawler complaint / exclusion request

No automated research crawling exists yet, so there is nothing to exclude a site from. Route any
inbound request via the existing `/contact` channel to a human; do not build a new intake mechanism
for a system that doesn't run.

## Capacity / research vs. paid monitoring priority

Not currently a live concern — publication generation is a single, synchronous, manually-triggered
D1 read/write, negligible next to scheduled monitoring. If Layer B is ever built, the priority
ordering from §41 applies unconditionally: customer-facing operations > scheduled paid monitoring >
retention/reliability jobs > research collection.
