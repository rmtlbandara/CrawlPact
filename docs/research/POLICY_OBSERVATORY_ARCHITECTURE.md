# Policy Observatory architecture

## Two different "Observatory" concepts — do not conflate

**Evidence Observatory** (pre-existing, `docs/design/EVIDENCE_OBSERVATORY_REDESIGN_SPEC.md`): the
product UI's evidence-led visual language for presenting _one domain's_ audit result (Observed →
Interpretation → Impact → Action → Evidence). Not touched by Phase 16 — its components may be
reused visually, but its naming, routes, and design system are unchanged.

**Policy Observatory** (Phase 16, this document): CrawlPact's public, reproducible research and
measurement layer for understanding how AI crawler-policy signals and crawler-registry information
change over time, in aggregate, across the ecosystem — not about any one domain.

## Two layers

**Layer A — Registry Observatory (built this phase, mandatory).** Uses only Phase 15's verified,
immutable registry release data. Crawler/operator counts, purpose and lifecycle distribution,
operator-by-purpose matrix, verification freshness, and release history with semantic-diff-based
change classification.

**Layer B — Website Policy Observatory (not built this phase, conditional).** Would use a
separately governed, versioned research corpus of publicly accessible websites. See
`PHASE_16_RESEARCH_CORPUS_DECISION.md` for why this gate is not yet met and what would need to be
true before it is built.

## Pipeline (Layer A, as actually implemented)

```
registry_versions / registry_version_entries (Phase 15, immutable)
  -> apps/web/src/lib/observatory/registry-observatory.ts
     (computeRegistryObservatoryForRelease / getRegistryObservatorySnapshot)
  -> apps/web/src/lib/research/publication-content.ts
     (buildRegistryLandscapeContent — deterministic, code-generated findings)
  -> apps/web/src/lib/admin/research.ts
     (draft -> review -> published -> corrected -> withdrawn; research_publications table)
  -> Public rendering: /observatory, /observatory/registry, /research, /research/[slug]
     (always reads the frozen, published content_json — never recomputes live on request)
```

There is no separate "collection" step for Layer A distinct from computation — a Registry
Observatory figure is deterministically derivable from an already-immutable release at any time,
so "collection" and "computation" are the same step. This is exactly why Layer A was buildable
this phase without a corpus/run/observation model: there is nothing to "collect," only to compute.

## Corrections and publication snapshot

Once published, a `research_publications` row's `content_json` is the frozen, publicly rendered
snapshot — public routes never recompute Registry Observatory metrics live for a _published_
article (they read the stored row). A correction recomputes from the _same pinned_
`registry_version_id` (never a newer one) and appends to `correction_log`; it never silently
rewrites history. See `RESEARCH_CORRECTION_AND_RETRACTION_POLICY.md`.

## Review

Automated (`validateResearchPublicationContent` / `pnpm research:validate`) plus a required manual
Super Admin `publish` action — never automatic (§45). See `RESEARCH_PUBLICATION_GOVERNANCE.md`.
