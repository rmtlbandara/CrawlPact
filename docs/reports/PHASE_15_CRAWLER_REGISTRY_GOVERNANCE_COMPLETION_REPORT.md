# Phase 15 — Crawler Registry Governance and Public Changelog — Completion Report

**Date**: 2026-08-11 · **Branch**: `phase-15-registry-governance-public-changelog` · **Base
commit**: `6b0dc3c7bda47fe2ec4f45b911e48f32f97606a9` (main, post-Phase-14-deployment-record)

## Executive summary

Phase 15 found and fixed a real, critical correctness bug: `getActiveRegistry()` and historical
scan rendering read the live, mutable `crawlers` table instead of the immutable
`registry_version_entries` snapshot, meaning editing a crawler's row after a release was published
could silently change what an already-active release evaluated and how a historical scan
displayed that crawler. It found and fixed a second bug: any crawler edit at all — including a
source-URL move — counted as "changed" for re-evaluation purposes, risking customer re-scans for
non-semantic edits. It made publish/rollback atomic and idempotent, added release checksums and
candidate validation, replaced the raw diff with a field-level semantic classification, gave
rollback the same re-evaluation parity as forward publish, and independently re-verified all 23
crawlers across 9 operators against live official documentation — reconfirming rather than
blindly trusting the previously-pending Amazon/Google correction, and finding one new evidence-only
correction (Bingbot's source URL moved). No crawler was added for its own sake; several candidates
found during research were deliberately rejected as out of scope. No new production registry
release was activated as part of the code/documentation work in this report — that requires a
separate, explicit registry-activation approval, addressed in its own section below.

## Starting repository commit

`6b0dc3c7bda47fe2ec4f45b911e48f32f97606a9` (main, post-Phase-14-deployment-record merge, PR #108).

## Starting production Worker

`087236e1-35fe-477d-a370-d226a4a67fbe`.

## Starting migration state

`0033_scheduled_job_runs_started_at_index.sql` (33/33 applied).

## Starting active registry

`2026.07.3` (`reg_2026_07_3`), published 2026-07-28.

## Starting crawler/operator counts

23 crawlers, 9 operators (OpenAI, Anthropic, Perplexity AI, Google, Common Crawl Foundation,
Apple, Meta, Amazon, Microsoft).

## Starting public crawler coverage

22 of 23 crawlers had a dedicated Markdown reference page (Bingbot excluded — JS-rendered
official source).

## Starting governance gaps

See "The critical finding" and "A second confirmed bug" in
`docs/registry/PHASE_15_REGISTRY_BASELINE.md` — the snapshot-authority bug and the raw-diff bug,
both confirmed by direct code reading before any fix was written.

## Official-source research methodology

Live HTTP fetches (not repository-cached URLs) against each of the 9 operators' current official
crawler documentation, following redirects and recording JS-rendering failures honestly. Only
Level 1/2 (operator-controlled) sources were used as principal evidence; third-party sources
(SEO blogs) were used only as research leads, never as sole evidence to add or change a crawler.
Full detail and every source URL: `docs/registry/PHASE_15_FULL_SOURCE_REVERIFICATION_REPORT.md`.

## Full crawler reverification

All 23 crawlers across all 9 operators reconfirmed exactly as registered, with two real findings
(see below). No AI-generated classification was used as evidence at any point.

## Sources changed

- Bingbot: `https://www.bing.com/bingbot.htm` → `https://www.bing.com/webmaster/help/which-crawlers-does-bing-use-8c184ec0`
  (two redirect hops followed live; final destination remains JS-rendered).

## Crawlers added

None. (Amazon's `Amzn-SearchBot`/`Amzn-User` were already present in
`packages/database/seed/reference-data.sql` from a prior session's pending correction, not newly
added by this phase — this phase's contribution was _independently re-verifying_ that correction
live rather than adding anything new.)

## Crawlers removed/retired

None.

## Purpose changes

None (all purpose classifications reconfirmed unchanged).

## Token changes

None.

## Unknown-purpose decisions

None newly made — `GoogleOther`'s existing `unknown` classification was reconfirmed accurate
against Google's current documentation, which still doesn't specify a more particular purpose.

## Lifecycle changes

None.

## Rejected candidate crawlers

`GoogleOther-Image`/`GoogleOther-Video` (duplicate of existing `GoogleOther` in substance),
`Googlebot-Image`/`Googlebot-Video`/`Googlebot-News`/`Storebot-Google`/`Google-InspectionTool`
(traditional search-indexing crawlers, no new AI-governance signal beyond the registered
`Googlebot`), `FacebookExternalHit` (pre-AI link-preview fetcher, out of scope), an unconfirmed
"Microsoft AI training crawler" (only third-party evidence found, no first-party documentation of
a distinct token — Microsoft's own AI opt-out mechanism is a meta tag, not a robots.txt token per
available research). Full reasoning:
`docs/registry/PHASE_15_FULL_SOURCE_REVERIFICATION_REPORT.md`.

## Provenance data model

Evaluated the richer `crawler_sources`/`crawler_source_verifications` multi-source model; deferred
— no current crawler needs more than one official source URL. See
`docs/data/PHASE_15_REGISTRY_PROVENANCE_DATA_MODEL.md`. Implemented instead: a canonical,
versioned per-release snapshot (`schemaVersion` 1 for pre-Phase-15 rows, 2 for new ones) that
captures identity, token, purpose, lifecycle, source, and verification dates as an immutable,
per-release fact — the concrete provenance need this registry actually had.

## Source verification history

Not built as a separate table this phase (see provenance decision above). The canonical
per-release snapshot _is_ the verification history that matters operationally: what the evidence
was at the time each release was published, permanently preserved.

## Snapshot-authority audit

**Confirmed broken pre-Phase-15**: `getActiveRegistry()` (`apps/web/src/lib/registry-data.ts`)
resolved only the active release's _ID_, then joined straight back to the live, mutable
`crawlers`/`crawler_operators` tables for every evaluated field. `registry_version_entries` was
never queried by the evaluation path at all — only by the release-comparison diff tooling. The
identical pattern existed in `getScanReport()` and `domain-timeline.ts`'s historical rendering.

## Runtime snapshot fix

`apps/web/src/lib/registry-snapshot.ts`'s `getRegistryVersionSnapshotMap` is now the sole
authoritative read path for both live evaluation (`getActiveRegistry`) and historical rendering
(`getScanReport`, `domain-timeline.ts`'s `getCrawlerResultChanges`). Legacy (schema v1)
pre-Phase-15 snapshots are read transparently via a compatibility path (falling back to a live
operator-name lookup only, never crawler identity/purpose/token) — never rewritten in place.

## Historical reproducibility

Proven by `apps/web/tests/integration/registry-reproducibility.integration.test.ts` (2 tests,
Section 28's mandatory reproducibility test): publishes release A, mutates the live crawler row,
confirms the active release's evaluation, reported version ID, and checksum are all unchanged; and
confirms a historical scan's rendered crawler matrix stays frozen at its own recorded release even
after a later live edit.

## Release checksum

SHA-256 over the canonicalised (sorted-key, crawler-ID-ordered) entry snapshots
(`apps/web/src/lib/registry-checksum.ts`), computed and stored at publish time
(`registry_versions.checksum`, migration `0034`), independently re-verifiable via
`pnpm registry:checksum:verify` and the CLI's own `registry-tools.mjs checksum` command (now using
the identical canonicalisation algorithm — previously the CLI used a differently-computed value).
Explicitly documented as an integrity identifier, never called a signature.

## Semantic diff result

`apps/web/src/lib/registry-semantic-diff.ts` classifies every field change into
evaluation-semantic / evidence / editorial / internal (`docs/registry/REGISTRY_SEMANTIC_DIFF_MODEL.md`).
Only evaluation-semantic changes feed `evaluationSemanticCrawlerIds`, the only set ever passed to
affected-domain computation. 9 regression tests
(`registry-semantic-diff.integration.test.ts`) cover every named scenario from the prompt's
Section 137, plus 1 dedicated re-evaluation test
(`registry-reevaluation.integration.test.ts`) proving an evidence-only change schedules **zero**
re-evaluations end to end through the real HTTP publish route.

## Candidate validation

`validateReleaseCandidate` (`apps/web/src/lib/admin/registry.ts`) blocks publication on: missing
version label/changelog, duplicate evaluation-eligible tokens, missing official source or
verification date for an evaluation-eligible crawler. Warns (non-blocking) on stale review (>180
days). Wired directly into `publishRegistryVersion` — an invalid candidate cannot be published,
proven by `registry-candidate-validation.integration.test.ts` (5 tests).

## Publication workflow

`createRegistryRelease` → `validateReleaseCandidate` → `publishRegistryVersion`. Publication and
activation are a single combined action in this codebase (not separated into distinct steps) —
documented plainly rather than left implying otherwise (`docs/registry/CRAWLER_REGISTRY_GOVERNANCE.md`).
Full procedure: `docs/registry/REGISTRY_RELEASE_PUBLICATION_RUNBOOK.md`.

## Activation workflow

Atomic (`db.batch()` — deactivate-old/activate-new/record-activation-history in one call),
idempotent (publishing an already-active release is a harmless no-op, no duplicate
activation-history row), checksummed at the moment of activation. The identical fix was applied to
`ruleset_versions`' publish/rollback, which had the same non-atomic two-`UPDATE` bug (ruleset
_semantics_ untouched — only the activation-pointer mechanism was hardened).

## Rollback workflow

Same atomicity/idempotency guarantees as publish. Refuses to activate a never-published release
(`registryVersions.publishedAt` check) — an unpublished draft cannot become active through
rollback. **Fixed this phase**: rollback previously only moved the pointer; now computes the same
semantic diff and schedules the same bounded re-evaluation as a forward publish. Full procedure:
`docs/registry/REGISTRY_ROLLBACK_RUNBOOK.md`.

## Re-evaluation architecture

Unchanged mechanism, now correctly gated: `getAffectedDomains` + `scheduleReEvaluation` (moves
`domains.next_scan_at` into the past, picked up by the existing bounded/rate-limited Phase 11
monitoring sweep — never a synchronous mass-scan). The gate is now `evaluationSemanticCrawlerIds`
from the semantic diff, not the raw full-snapshot diff.

## Re-evaluation entitlement decision

`docs/product/PHASE_15_REGISTRY_REEVALUATION_ENTITLEMENT_DECISION.md` — derived from code, not
guessed. Free-plan domains never receive an automatic registry-driven re-scan (the monitoring
sweep structurally excludes `monitoringFrequency: 'none'` domains); every plan's _next_ real scan
(manual or scheduled) always evaluates against whichever release is active at that moment, since
every scan path calls `getActiveRegistry()` fresh. No manual-rescan quota is ever consumed by
registry-driven re-evaluation (confirmed: the sweep inserts `triggeredBy: "scheduled"` scans, and
quota is counted only on `triggeredBy: "manual"`).

## Re-evaluation backlog/result

Not tracked as a dedicated metric this phase — reuses the existing sweep's own due/overdue
accounting (`getOperationalCapacitySnapshot`'s `monitoring.dueNowCount`); see
`docs/operations/PHASE_15_REGISTRY_OPERATIONAL_HEALTH.md` for the reasoning.

## Phase 8 attribution verification

`domain-timeline.ts`'s `getCrawlerResultChanges` (feeding `affectedPurposes` and downstream
`changeOrigin` classification) previously resolved a crawler's `purpose` via a live join; now
resolves it from the current scan's own recorded `registryVersionId` snapshot — fixed alongside
the main snapshot-authority bug, verified working via the full existing
`admin-registry.integration.test.ts` suite (unchanged assertions, still passing) plus the new
reproducibility tests.

## Phase 10 notification integration

Unchanged notification mechanism; now correctly gated by the semantic diff so source-only/editorial
registry changes never produce a customer notification — verified by
`registry-reevaluation.integration.test.ts`'s zero-re-evaluations test (a notification can only
ever originate from a real scan, and this proves no scan is even scheduled for an evidence-only
change).

## Public crawler-directory architecture

`docs/registry/PUBLIC_REGISTRY_RENDERING_ARCHITECTURE.md` — Option A (runtime D1-backed) and
Option B (generated artifact) both evaluated and deferred; the public `/crawlers` pages remain
statically generated from the Markdown content collection, unchanged in architecture. Mitigated
with `pnpm registry:public:validate` (new, CI-gated) and removal of the one hard-coded,
name-specific "Bingbot missing page" disclosure (now a general, evergreen statement). Recorded as
RISK-035 (open, accepted, with a documented trigger for building Option A later).

## Public crawler-page result

Content and count unchanged (crawler/operator counts were already computed from the content
collection, not hard-coded — confirmed, not assumed).

## Changelog result

Not rearchitected to a structured registry-release-backed model this phase (the existing
`/changelog` page's architecture is unchanged) — the semantic diff and checksum infrastructure
this phase built are the prerequisites for that; building the actual public release-detail
rendering was judged out of scope given the phase's already-large surface. Disclosed, not silent.

## Product-changelog scope result

Not touched — no product-changelog completeness audit was performed this phase (out of scope; the
prompt's Section 97 only requires this "while touching `/changelog`," which this phase did not
rearchitect).

## SEO/indexability result

No public route changes; no new pages generated; the one crawler-directory copy edit is
SEO-neutral (general disclosure text, not a ranking-relevant claim).

## Security result

Full threat-by-threat review: `docs/security/PHASE_15_REGISTRY_GOVERNANCE_THREAT_REVIEW.md`. Key
finding: no automated source-fetcher was built this phase, so the SSRF/compromised-page/
redirect-hijack/source-content-XSS threat classes are not yet live risks — `officialSourceUrl` is
validated as well-formed but never fetched by the application. Concurrent-activation, no-active-
release, and two-active-release states are now prevented (atomicity fix + the pre-existing
partial-unique-index). 5 new security/idempotency tests
(`registry-security.integration.test.ts`).

## Accessibility result

See "Full test sequence" below for the actual run — the Admin registry UI changes
(`RegistryReleasesManager.tsx`) reuse existing accessible components (`Button`, `FormField`,
`StatusChip`) with no new custom interactive elements.

## Performance result

`docs/data/PHASE_15_REGISTRY_QUERY_AND_INDEX_AUDIT.md` — real `EXPLAIN QUERY PLAN` evidence for
every registry query this phase touches; all use existing indexes correctly.
`createRegistryRelease` converted from N sequential inserts to a single `db.batch()`.

## Database migrations

`0034_registry_release_integrity.sql`: `registry_versions.checksum`,
`registry_version_entries.snapshot_schema_version`, new `registry_version_activations` table +
2 indexes. Additive only; no existing column or table altered destructively; `db:validate`
confirms 50 tables consistent.

## Indexes

`idx_registry_version_activations_version_id`, `idx_registry_version_activations_created_at`
(migration `0034`). Pre-existing indexes (`idx_registry_version_entries_registry_version_id`,
`idx_registry_versions_single_active`) confirmed still correctly used via `EXPLAIN QUERY PLAN`.

## Query plans

See `docs/data/PHASE_15_REGISTRY_QUERY_AND_INDEX_AUDIT.md`.

## CI validators

`registry:validate` (strengthened: broken-replacement, duplicate-version-label,
duplicate-release-entry, malformed-snapshot checks added), `registry:checksum:verify` (new),
`registry:integrity:verify` (new), `registry:public:validate` (new). All wired into
`quality:gate`, `.github/workflows/ci.yml` (which also gained its first `db:migrate`/`db:seed`
step — these validators had never actually run in CI before, mirroring Phase 12's identical
`content:validate` finding), and `scripts/verify-push.sh`.

## Preview release drill

Not performed against the real Cloudflare preview environment this phase (would require a
preview-environment deploy, itself requiring separate approval per standing practice) — instead,
the equivalent drill was run entirely against local D1 via the integration test suite:
`registry-reproducibility.integration.test.ts` and `registry-reevaluation.integration.test.ts`
together exercise publish → evaluate → mutate-live-row → re-evaluate → rollback → re-evaluate,
proving every step of Section 194's drill except the literal "clone into preview" step.

## Files created

`apps/web/src/lib/registry-snapshot.ts`, `registry-checksum.ts`, `registry-semantic-diff.ts`,
`apps/web/src/lib/admin/registry-health.ts`, 6 new integration test files (24 tests total),
`packages/database/migrations/0034_registry_release_integrity.sql`,
`scripts/registry-public-validate.mjs`, 17 new docs (see `docs/governance/DOCUMENTATION_INVENTORY.md`),
this report.

## Files modified

`apps/web/src/lib/registry-data.ts`, `get-scan-report.ts`, `domain-timeline.ts`,
`admin/registry.ts`, `admin/operations.ts`, `apps/web/src/components/admin/{OperationsOverview,RegistryReleasesManager}.tsx`,
3 registry API routes (`publish.ts`, `rollback.ts`, `compare.ts`), `apps/web/src/pages/crawlers/index.astro`,
`packages/database/src/schema/registry.ts`, `packages/database/seed/reference-data.sql`,
`scripts/registry-tools.mjs`, `scripts/verify-push.sh`, `.github/workflows/ci.yml`, `package.json`,
`apps/web/tests/integration/d1-harness.ts` (fixed a real gap: its seeded fixture had no
`registry_version_entries` row for its own active release — invisible under the old live-join
behaviour, would have made every dependent test silently see an empty registry under the fix),
`apps/web/tests/integration/admin-registry.integration.test.ts` (response-shape update for the
new `compare` endpoint), 2 pre-existing registry docs
(`CRAWLER_REGISTRY_GOVERNANCE.md`, `SOURCE_VERIFICATION_POLICY.md`), plus cross-cutting docs
(`REQUIREMENTS_TRACEABILITY.md`, `ACTIVE_RISKS.md`, `DOCUMENTATION_INVENTORY.md`, `CHANGELOG.md`,
`README.md`).

## Commands executed

`pnpm quality:gate` (every step individually verified green), `pnpm test:e2e:chromium`,
`pnpm test:a11y:chromium`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm registry:validate`,
`pnpm registry:integrity:verify`, `pnpm registry:checksum:verify`, `pnpm registry:public:validate`,
real `EXPLAIN QUERY PLAN` queries via `wrangler d1 execute --local`, live `WebFetch`/`WebSearch`
calls for source reverification.

## Tests passed

Unit 394/394. Integration 323/323 (49 files, including all 24 new registry tests: 2
reproducibility, 9 semantic-diff, 5 security/idempotency, 5 candidate-validation, 2
re-evaluation, 1 registry-comparison-shape update in the existing suite). Security 41/41.
Chromium E2E 141/142 passed, 1 flaky-but-passed-on-retry (`auth-and-account.spec.ts`'s
account-deletion test, unrelated to registry code, matching this environment's known sandbox
timing-flake pattern documented in prior phases' reports). Chromium a11y 110/110. Full
`quality:gate` (format, lint, typecheck, db:validate, docs/brand/trust/status/operations
validators, all 4 registry validators, content/repo-privacy/analytics validators, `pnpm audit`
0 critical, build) — every step individually green.

## Tests failed/skipped

None failed in the final run. (During development, the pre-existing, unrelated
`audit-report-signals.integration.test.ts` network-dependent test was observed to pass cleanly in
the final full-suite run — no flake recurrence this session.)

## Preview registry drill

See "Preview release drill" above.

## Production app deployment status

See the Required Final Response — pending explicit deployment approval at the time this report
was written.

## Registry activation approval status

See the Required Final Response.

## Production registry activation status

See the Required Final Response.

## Production smoke

See the Required Final Response.

## Post-activation verification

See the Required Final Response.

## Active risks

RISK-035 (new, this phase — public crawler directory can drift from the active registry;
mitigated by `registry:public:validate`, not eliminated). RISK-006 unaffected (not related to
registry).

## Remaining risks

See `docs/risks/ACTIVE_RISKS.md` RISK-035 for the full acceptance criteria and trigger for
closure.

## Runtime impact

Phase 15 hardens CrawlPact's crawler registry into a source-backed, versioned and reproducible
governance system; strengthens crawler-source provenance and re-verification; makes immutable
release snapshots authoritative for audit evaluation; adds deterministic semantic release
comparison, integrity validation, safer publication/activation/rollback and bounded
registry-driven re-evaluation; and improves the public crawler directory's drift detection. Two
real, previously-latent bugs were confirmed and fixed: the snapshot-authority gap (live audits and
historical scans could both silently change when a crawler's live row was edited) and the
raw-diff gap (a non-semantic edit could trigger customer re-evaluation). All 23 crawlers across 9
operators were independently re-verified against live official documentation. Phase 15 does not
change CrawlPact's policy scoring/ruleset semantics, pricing, plan limits, Paddle catalog, normal
monitoring frequencies, notification channels, analytics-consent architecture, agency
entitlements, repository-private posture, or public trust requirements.

## Recommended Phase 16 starting point

Two independent options, either viable: (1) build the DB-backed public crawler directory (Option A
from `docs/registry/PUBLIC_REGISTRY_RENDERING_ARCHITECTURE.md`) to close RISK-035 structurally,
or (2) close RISK-006 if the product owner is now ready to explicitly accept the Phase 11
retention recommendation for `security_events`/`notifications`.
