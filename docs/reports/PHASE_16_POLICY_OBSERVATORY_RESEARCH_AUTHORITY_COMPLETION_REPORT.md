# Phase 16 — Policy Observatory and Research Authority — Completion Report

## Executive summary

Phase 16 built CrawlPact's Registry Observatory (Layer A) — a public, reproducible research layer
computed exclusively from Phase 15's immutable crawler registry — plus the full research-governance
and publication framework (methodology, claim classification, correction/retraction policy,
checksummed reproducibility, Super Admin publish workflow). The Website Policy Observatory
(Layer B — a website-policy benchmark study) was **deliberately not built**: no approved research
corpus exists, and the Phase 16 prompt itself (§12/§188/§189/§227) sanctions shipping a strong
Registry Observatory plus full methodology framework as a complete outcome rather than publishing a
weak or unrepresentative statistic. No publication has been published to production this phase —
the mechanism was verified end-to-end against real D1 in integration tests, but generating and
publishing a real draft requires a live Super Admin session, consistent with how Phase 15 handled
registry-release activation.

## Starting repository/production state

Commit `4a0330f` (main), Worker `686987b8-3dd6-44b8-9f32-8b877d8e4655`, migration `0034` (34/34).
See `docs/research/PHASE_16_POLICY_OBSERVATORY_BASELINE.md` for full detail.

## Starting active registry

`2026.07.3` (23 crawlers, 9 operators) — independently re-confirmed via a live D1 query at the
start of this phase. Unchanged throughout Phase 16.

## Phase 15 dependencies

`getRegistryVersionSnapshotMap()` (crawler identity, v1/v2 compatible), `computeSemanticDiff()`
(field-level change classification), and the release-checksum canonicalisation pattern were all
reused unchanged, never re-implemented — see `docs/research/POLICY_OBSERVATORY_ARCHITECTURE.md`.

## Evidence Observatory vs. Policy Observatory distinction

Documented explicitly in `docs/research/POLICY_OBSERVATORY_ARCHITECTURE.md`'s opening section: the
pre-existing Evidence Observatory (product UI, one-domain evidence-led visual language) is
unchanged and unconflated with the new Policy Observatory (public, aggregate, ecosystem-level
research). No existing Evidence Observatory component, route, or naming was touched.

## Research authority principles

Enforced by `BANNED_CLAIM_PATTERNS` (definitive, world's most, most websites, industry standard,
comprehensive global study, peer-reviewed, academic study, scientific consensus, sensational
phrasing) scanned against every publication before it can leave `draft` status, plus every finding
carrying an explicit numerator/denominator/scope (§77) — see
`docs/research/RESEARCH_CLAIM_CLASSIFICATION.md`.

## Customer-data / anonymous-audit / product-analytics boundaries

Verified structurally, not just by policy: no Observatory/research code path reads `domains`,
`scans`, `scan_resources`, `scan_crawler_results`, or `product_events` — confirmed by reading every
new file in full. See `docs/security/PHASE_16_RESEARCH_PRIVACY_THREAT_REVIEW.md`.

## Registry Observatory

`lib/observatory/registry-observatory.ts`'s `getRegistryObservatorySnapshot`/
`computeRegistryObservatoryForRelease` compute crawler/operator counts, purpose and lifecycle
distribution, an operator-by-purpose matrix, verification freshness (verified/never-verified/
review-due, using the same 180-day threshold `registry-tools.mjs` already used), and a per-release
semantic-diff-based change history (added/removed/purpose changes/token changes/evidence-only
changes) — scoped to releases published at or before the release in question, so a publication's
narrative never silently drifts when a later release is published (a real bug found and fixed
during this phase's own integration testing).

## Registry metrics

See `docs/research/RESEARCH_METRIC_DICTIONARY.md` for the full numerator/denominator/exclusion
table for every metric.

## RISK-035 decision

Re-evaluated, not closed. Option C: `/crawlers` left unchanged; the new Observatory was built
structurally immune to the same drift risk from the start (live D1 read, no Markdown source). See
`docs/product/PHASE_16_RISK_035_DECISION.md`.

## Research corpus decision

No corpus built. Options A–D evaluated; Option A (fixed curated benchmark) preferred once
genuinely undertaken, not attempted this phase. See `docs/research/PHASE_16_RESEARCH_CORPUS_DECISION.md`.

## Corpus methodology / research crawler policy

No corpus exists, so no collection methodology was needed. `docs/research/RESEARCH_CRAWLING_POLICY.md`
is a forward-looking policy for if/when Layer B is built — not a description of a running system.

## Research data model

One table, `research_publications` (migration `0035`) — deliberately not the fuller
studies/corpora/runs/observations model the prompt sketches as _possible_, since nothing beyond a
single deterministic, code-generated publication kind exists. See
`docs/data/PHASE_16_RESEARCH_DATA_MODEL.md`.

## Research storage model / retention

Negligible (a few KB per publication, manual publication cadence only). See
`docs/data/PHASE_16_RESEARCH_STORAGE_CAPACITY_MODEL.md` and
`docs/research/RESEARCH_DATA_RETENTION_POLICY.md`.

## Research run versioning / registry-ruleset pinning

Every publication pins `registry_version_id` at generation time; `correctResearchPublication`
refuses to recompute against a different (newer) release than the one originally pinned, requiring
a new publication instead — verified by
`research-publication-reproducibility.integration.test.ts`.

## Metric dictionary

`docs/research/RESEARCH_METRIC_DICTIONARY.md`.

## Missing-data model / sample-size policy / small-cell policy

Missing data is explicit ("never verified"), never silently absent. Small-cell suppression (20
observations) is defined but not applicable to Layer A's exhaustive population counts. See
`docs/research/RESEARCH_METHODOLOGY.md`.

## Longitudinal comparison rules

A release-history entry is a single "change since previous release" until ≥3 comparable published
releases exist (`TREND_MIN_COMPARABLE_RUNS`) — never a "trend" from two points.

## Research publication workflow

draft → review → published → corrected → withdrawn, gated by `requireAdminAction` at every
mutation (session + step-up passkey + required reason + audit log), matching Phase 15's registry-
release publish/rollback discipline exactly. See `docs/research/RESEARCH_PUBLICATION_GOVERNANCE.md`.

## Correction/retraction policy

`docs/research/RESEARCH_CORRECTION_AND_RETRACTION_POLICY.md` — correction recomputes from the same
pinned release and appends a visible log entry; withdrawal is terminal but the row/URL remain,
rendered with a notice.

## Research integrity/reproducibility

SHA-256 checksum over publication content, excluding `generatedAt`/`correctionLog` (a real bug
found and fixed this phase — including a wall-clock timestamp in the checksum made every
reproduction spuriously fail even when nothing real had changed). Verified end-to-end by
`research-publication-reproducibility.integration.test.ts` (matches after live-table mutation and
after a newer release becomes active) and `pnpm research:integrity:verify`.

## First publication

"AI Crawler Registry Landscape" — mechanism verified end-to-end against real D1 (5 findings, 4
sections, 4 limitations, real checksum), but **not generated against the real production dataset or
published**, since that requires a live Super Admin session. See
`docs/research/PHASE_16_FIRST_RESEARCH_PUBLICATION_EVIDENCE.md` for the full generated-output
evidence and exact numerators/denominators from the test run.

## Public route architecture / SEO / structured data

`docs/product/PHASE_16_OBSERVATORY_ROUTE_ARCHITECTURE.md`. `/observatory*` added to
`sitemap.xml.ts`; `/research*` deliberately excluded (build-time sitemap generation has no D1
access, and nothing is published yet). `BaseLayout`'s existing Article/BreadcrumbList JSON-LD
pattern reused unchanged for `/research/[slug]` (`ogType="article"`); no fabricated author, no
`Dataset` schema (no downloadable dataset exists).

## Public data download decision

No JSON/CSV export or API this phase — see
`docs/product/PHASE_16_PUBLIC_RESEARCH_AND_DATA_DOWNLOAD_DECISION.md`.

## Super Admin research

`/admin/research` + `ResearchManager.tsx` — generate draft, submit for review, publish, correct,
withdraw. Added to `AdminNav.astro`'s "Crawler intelligence" group.

## Operations integration

`docs/operations/PHASE_16_RESEARCH_OPERATIONS_RUNBOOK.md` — no background job exists, so most
prompt-anticipated failure scenarios (stuck run, capacity) don't yet apply; documented what can
actually go wrong with the shipped, synchronous, manually-triggered feature.

## Privacy review / Security review

`docs/security/PHASE_16_RESEARCH_PRIVACY_THREAT_REVIEW.md`,
`docs/security/PHASE_16_RESEARCH_SECURITY_THREAT_REVIEW.md` — no finding requiring a code change;
most threat categories (SSRF, corpus poisoning) have no applicable surface since Layer B wasn't
built. Admin mutations verified to route through the same `requireAdminAction`/`assertSameOrigin`
CSRF mechanism every other admin route uses.

## Accessibility

Every table (findings, purpose distribution, lifecycle, operator matrix, release history) is real
HTML `<table>` markup with `<caption>`/`scope` attributes — the authoritative representation, not a
chart (no chart library was added at all). Not independently re-run through the Chromium a11y suite
this pass beyond what `pnpm quality`'s existing gate covers (see Tests below); a full manual a11y
pass (200% zoom, forced colours, screen reader) was not performed this session.

## Performance

All new public pages are server-rendered, mostly-zero-JS (only `<AnalyticsBeacon>` React islands),
publicly cached (120s hub/registry, 3600s published articles), no client-side chart library.

## D1 migrations

One: `0035_research_publications.sql` — additive, one new table, two new indexes. `pnpm db:validate`
confirms 51 tables consistent between migrations and the Drizzle schema.

## Query plans

`docs/data/PHASE_16_RESEARCH_QUERY_AND_INDEX_AUDIT.md` — real `EXPLAIN QUERY PLAN` output for every
`research_publications` query, run against local D1.

## Validators

`pnpm research:validate`, `pnpm research:integrity:verify` — wired into `quality:gate`, CI
(`.github/workflows/ci.yml`), and `scripts/verify-push.sh`, in the same position as the Phase 15
registry validators (after `db:migrate`/`db:seed`).

## Files created / modified

25 new files (migration, schema, 6 lib files, 5 API routes, 1 React component, 1 admin page, 5
public pages, 3 integration test files, 1 unit test file, 21 docs — see
`docs/governance/DOCUMENTATION_INVENTORY.md`); 14 modified files (schema barrel, analytics.ts,
sitemap.xml.ts, AdminNav.astro, package.json, ci.yml, verify-push.sh, PRODUCT_EVENT_REGISTRY.md,
ACTIVE_RISKS.md, CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md, REQUIREMENTS_TRACEABILITY.md,
README.md, CHANGELOG.md, DOCUMENTATION_INVENTORY.md).

## Commands executed

`pnpm db:migrate`, `pnpm db:validate`, `pnpm db:seed` (partial — pre-existing local data, tolerated
per established pattern), `node scripts/research-tools.mjs validate`/`integrity:verify` (against
local D1), `pnpm typecheck`, `pnpm lint`, targeted `vitest run` for new unit/integration tests, and
the full `pnpm quality` gate (see Test results below).

## Test results

Reported after the full `pnpm quality` run below — see the Required Final Response for exact
pass/fail counts.

## Production deployment / Publication approval / Production verification

Not yet performed as of this report's initial draft — see the Required Final Response for the
final status once the PR is merged and (if approved) deployed.

## Risk closure

None closed. RISK-035 re-evaluated (not closed, see above). No new risk was found or recorded this
phase — the closest candidate (sitemap can't reflect D1-backed `/research` state) was judged not to
meet the bar for a new numbered risk, since it's disclosed and self-consistent (nothing is
published, so nothing is missing from the sitemap yet); documented instead in
`docs/product/PHASE_16_OBSERVATORY_ROUTE_ARCHITECTURE.md` as a known gap to revisit at first
publication.

## Remaining limitations

- Layer B does not exist.
- No publication has been published to production.
- `/research`'s sitemap coverage is deferred until the sitemap can reflect D1 state or a first
  publication ships.
- No downloadable data export exists.
- Full manual accessibility re-verification (200% zoom, screen reader, forced colours) was not
  performed this session beyond the automated Chromium a11y suite already in `pnpm quality`.

## Recommended Phase 17 starting point

Phase 17 is explicitly commercial/customer-validation work per its own charter and per this
phase's §219 boundary — Phase 16's own unfinished thread (generating and publishing the first real
Registry Landscape publication, and revisiting Layer B if a real research need emerges) is a small,
separate follow-up for a future session with real Super Admin credentials, not a Phase 17
dependency.
