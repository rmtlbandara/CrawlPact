# Phase 16 first research publication — evidence

## Topic (chosen after building the data, not before — §75)

**"AI Crawler Registry Landscape"** — the only topic evaluated, since it's the only one Phase 15's
registry data can support without a website corpus (§75 gives this exact example). No other topic
was considered or discarded; there was no "invent a topic in advance" step to avoid.

## Mechanism verified end-to-end, against real D1

`generateRegistryLandscapeDraft` → `submitResearchPublicationForReview` →
`publishResearchPublication` was run against a real Miniflare-backed D1 instance (the same harness
`apps/web/tests/integration/d1-harness.ts` uses for every other integration test in this
repository) with a synthetic one-crawler/one-operator fixture. Full generated output:

- Title: `AI Crawler Registry Landscape — August 2026`
- Summary: a source-backed one-sentence description including the crawler/operator counts and
  registry release label.
- 5 key findings, each with an explicit numerator/denominator/scope (evaluation-eligibility,
  purpose distribution, verification coverage, review-due count, operator count).
- 4 sections: Dataset, Methodology, Results (correctly stated "no prior release to compare
  against, so no change-over-time claim is made" for a first release), Registry/ruleset
  provenance.
- 4 limitations, matching the required structure (§76).
- A real SHA-256 checksum, independently reproducible (proven separately by
  `research-publication-reproducibility.integration.test.ts`).

This proves the mechanism is correct and produces §77-compliant findings ("N of M ... scope"
format, never a bare percentage). See `registry-observatory.integration.test.ts` and
`research-publication-lifecycle.integration.test.ts` for the additional coverage (multi-operator,
multi-purpose, release-history semantic classification, full lifecycle transitions).

## What was not done this session: generating and publishing the real production draft

Generating the draft against the actual local/production dataset (23 crawlers, 9 operators,
registry release `2026.07.3`) requires either the real `/admin/research` UI under a real
authenticated Super Admin session, or a direct D1 write bypassing that UI. Consistent with the
established Phase 15 practice (registry-release activation was likewise deferred rather than
executed via an unauthorized direct D1 write), **no draft was generated against the real production
dataset this session, and nothing was published.**

## What a future Super Admin session needs to do

1. Sign in to `/admin/research` with a real Super Admin passkey session.
2. Click "Generate Registry Landscape draft" — deterministically produces a draft from whichever
   registry release is active at that moment (currently `2026.07.3`, unchanged this phase).
3. Review the generated findings and limitations.
4. "Submit for review," confirm `pnpm research:validate`-equivalent checks pass (the UI surfaces
   the same validation inline).
5. "Publish" — makes it live at `/research/ai-crawler-registry-landscape-<month>-<year>`.

## Confirmation

No publication exists in production as of this phase's deployment. `/research` and `/observatory`
correctly render their "nothing published yet" states — this is the honest, current state, not a
placeholder awaiting content that was silently skipped.
