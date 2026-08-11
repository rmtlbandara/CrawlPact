# Phase 16 Policy Observatory baseline

Recorded at the start of Phase 16 (Policy Observatory and Research Authority), before any
Observatory code existed, so later claims about what changed can be checked against a real
starting point rather than an assumed one.

## Starting repository/production state

- Repository commit at start: `4a0330f` (main, post-Phase-15 deployment record merge).
- Production Worker: `686987b8-3dd6-44b8-9f32-8b877d8e4655`, migration `0034` (34/34 applied).
- Active registry release: `2026.07.3` (23 crawlers, 9 operators) — independently re-verified via a
  live D1 query at the start of this phase, matching the Phase 15 completion state.
- Phase 15's prepared registry correction (Bingbot/Google-Extended source-URL fixes) had **not**
  been activated — it remained ready in `packages/database/seed/reference-data.sql`, deliberately
  deferred by explicit user choice at the end of Phase 15.

## Existing research capability before Phase 16

None. No `research_*` tables, no `/observatory` or `/research` routes, no research methodology
documentation existed. `docs/design/EVIDENCE_OBSERVATORY_REDESIGN_SPEC.md` and
`EVIDENCE_OBSERVATORY_REDESIGN_DELIVERABLES.md` describe a _different_, pre-existing concept — the
product UI's evidence-led visual language for one domain's audit result (Observed → Interpretation
→ Impact → Action → Evidence). Phase 16's "Policy Observatory" is a distinct concept: a public,
aggregate research layer about the crawler-policy ecosystem, not about any one domain. See
`POLICY_OBSERVATORY_ARCHITECTURE.md` for how the two are kept separate.

## Existing source data usable for research

- Phase 15's immutable `registry_versions`/`registry_version_entries`/`registry_version_activations`
  tables — verified, versioned, checksummed crawler-identity data. This is what Layer A (Registry
  Observatory) is built on.
- No existing table contains safe, already-governed aggregate website-policy research inputs.
  `scans`/`scan_crawler_results`/`findings` are customer-scoped product data, not a research corpus
  — see `PHASE_16_RESEARCH_CORPUS_DECISION.md` for why they are not reused directly.

## Missing pieces (why Layer B is not built this phase)

- No approved, versioned, bounded research corpus of public websites exists.
- No research crawling policy had been approved (a policy now exists — see
  `RESEARCH_CRAWLING_POLICY.md` — but no automated collection has been implemented or run).
- No capacity measurement, privacy review, or methodology document existed for a website-level
  study.

## Privacy/capacity constraints

- Customer saved-domain portfolios, Agency client portfolios, private scan histories, and product
  analytics (`product_events`) are all out of scope for the public research dataset by default
  (§7–§9 of the Phase 16 prompt) — enforced structurally by never reading those tables from any
  Observatory code path (verified by reading every new file in this phase; see
  `PHASE_16_RESEARCH_PRIVACY_THREAT_REVIEW.md`).
- No live D1 capacity budget has been consumed by research collection, since none runs
  automatically — see `PHASE_16_RESEARCH_STORAGE_CAPACITY_MODEL.md`.

## Phase 15 dependencies this phase relies on

- `apps/web/src/lib/registry-snapshot.ts`'s `getRegistryVersionSnapshotMap()` — the sole
  authoritative read path for crawler identity, reused unchanged.
- `apps/web/src/lib/registry-semantic-diff.ts`'s `computeSemanticDiff()` — reused to classify
  release-history changes without re-implementing diff logic.
- `apps/web/src/lib/registry-checksum.ts`'s canonicalisation pattern — the model for
  `apps/web/src/lib/research/publication-checksum.ts`.

## Current public surfaces this phase adds

`/observatory`, `/observatory/registry`, `/observatory/methodology`, `/research`,
`/research/[slug]`, and the Super Admin `/admin/research` workspace. See
`PHASE_16_OBSERVATORY_ROUTE_ARCHITECTURE.md`.
