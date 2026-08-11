# Research publication governance

## Lifecycle

```
draft --submitResearchPublicationForReview--> review --publishResearchPublication--> published
published --correctResearchPublication--> corrected
published/corrected --withdrawResearchPublication--> withdrawn (terminal)
```

`superseded` is modelled in the `status` column/type for a future publication that explicitly
replaces an older one, but is not produced by any code path this phase (only one publication kind,
one instance, exists).

## Manual publication, always

Collection/computation may run any time an admin requests a draft. Publication is never automatic
— `submitResearchPublicationForReview` and `publishResearchPublication` are each a distinct,
explicit Super Admin action, gated by `requireAdminAction` (session + step-up passkey
re-authentication + a required ≥3-character reason + audit log), matching the exact discipline
`admin/registry.ts` established for registry-release publication in Phase 15.

## Review gate

`submitResearchPublicationForReview` runs `validateResearchPublicationContent()` and refuses to
advance past `draft` if any error is found: missing title/summary/methodology version/registry
version, no key findings, no limitations, a finding with numerator > denominator or a negative
count, a missing `scope`, or text matching a banned unsupported-claim pattern. Warnings (e.g. a
zero-denominator finding) do not block, but are surfaced in the admin UI.

## Publish-time re-verification

`publishResearchPublication` re-validates and recomputes the checksum immediately before flipping
status — refusing to publish if the recomputed checksum doesn't match what was stored at draft
time, which would indicate the content was tampered with or corrupted between review and publish.

## Idempotency

Publishing an already-published or already-corrected row is a no-op (`{ alreadyPublished: true }`),
not an error — safe to retry, matching the registry-release publish/rollback pattern.

## Audit trail

Every mutation (`generate_draft`, `submit_review`, `publish`, `correct`, `withdraw`) is logged via
`requireAdminAction`'s built-in audit log at the API-route layer — not a second, separate audit
mechanism. Individual research-publication-generation runs are not logged as if they were
individual site fetches (there are none — see `PHASE_16_RESEARCH_CORPUS_DECISION.md`).

## What Phase 16 does not build

A `research_studies`/`research_corpora`/`research_runs`/`research_observations` model, a corpus
management UI, a research-run kill switch, or run idempotency-by-origin — none of these are needed
for a Layer-A-only, no-corpus publication kind. They would be built alongside Layer B, not before
it's needed.
