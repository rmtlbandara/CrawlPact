---
Document owner: Engineering owner
Status: current-authoritative
Last verified: 2026-08-11
---

# Registry Reverification Policy

Defines the cadence and triggers for re-verifying a crawler's official source (Phase 15, Section
24-25).

## Standard review cadence

**180 days.** This is the existing threshold `scripts/registry-tools.mjs`'s `validate()` command
already used pre-Phase-15 ("active crawlers whose `last_verified_at` is >180 days old" — a
warning, not a hard failure). Phase 15 keeps this exact threshold rather than inventing a new one
without justification (Section 24 explicitly warns against that) and now also enforces it inside
`validateReleaseCandidate` (`apps/web/src/lib/admin/registry.ts`) as a **warning**, surfaced in
the Super Admin release-comparison impact preview.

## Review-due threshold

A crawler is `review_due` when `lastVerifiedAt` is more than 180 days old. This is a warning, not
a publication-blocking condition — Section 24 explicitly separates "review-due threshold" from
"publication-blocking threshold if appropriate," and this phase judged a stale review alone should
not block an otherwise-valid release (the crawler is still verified, just due for a refresh).

## Publication-blocking threshold

A crawler that is evaluation-eligible (`active`/`deprecated`/`replaced`) but has **no**
`lastVerifiedAt` at all, or **no** `officialSourceUrl`, blocks publication —
`validateReleaseCandidate`'s `missing_verification_date`/`missing_official_source` errors. This is
not a time-based threshold; it is a completeness check that existed conceptually before Phase 15
(FR-REG-005) and is now enforced structurally at publish time rather than only by the CLI
validator.

## Triggers for re-verification

- **Source-change trigger**: `scripts/registry-tools.mjs validate` and the eventual live
  source-health process (Section 19, evaluated but not built this phase — see
  `docs/registry/PHASE_15_REGISTRY_OPERATIONAL_HEALTH.md`) flag a crawler whose source content
  fingerprint changed since last review.
- **Operator-announcement trigger**: manual — a team member notices an operator blog post,
  changelog, or documentation update about crawler behaviour and re-verifies.
- **Correction-report trigger**: a customer or the public correction path
  (`docs/registry/REGISTRY_CORRECTION_WORKFLOW.md`) reports a discrepancy.

## Verification exceptions

If a crawler cannot currently be reverified (e.g. its source is temporarily unreachable) but
strong prior official evidence exists, the existing verification date is **never** silently
refreshed to fake currency. This phase did not build a dedicated
`registry_verification_exceptions` table — with only 23 crawlers and no crawler currently in this
state, the overhead of a new table/UI was judged premature (Section 154: "do not add everything
unless justified"). Instead, the disclosed behaviour is: an unreachable source stays at its last
real `lastVerifiedAt`, accumulates a `stale_verification` warning past 180 days, and is documented
in admin release notes when relevant. If this becomes a recurring situation, add the exception
table then — the schema is additive and can be introduced without disrupting existing releases.

## What a source failure does _not_ do

Per Section 23, a temporary `404`/`403`/timeout/JS-rendering issue never automatically deletes,
retires, or reclassifies a crawler. It is recorded for human review; any resulting lifecycle or
classification change is always a deliberate, separately-reasoned admin action published through
a normal release, not an automatic side effect of a failed check.
