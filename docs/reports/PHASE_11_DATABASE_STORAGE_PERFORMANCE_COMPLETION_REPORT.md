# Phase 11 — Database, Storage, Retention and Performance Hardening — Completion Report

## Executive summary

Phase 11 hardened CrawlPact's data layer and performance posture using real, measured production
evidence rather than the multi-phase-old estimates the earlier capacity documents were built on.
It closed two real production bugs (`scan_diffs`/`audit_continuations` foreign keys with no
`ON DELETE` behavior, RISK-005; deleted-account billing history hidden by an `INNER JOIN`,
RISK-009), reduced the two largest `scan_resources` storage contributors by roughly two orders of
magnitude (`html_meta`/`sitemap`, RISK-007), replaced unbatched per-statement D1 writes with a
single atomic `db.batch()` per scan, hardened the daily retention purge with chunking/dry-run/
per-category failure isolation, fixed a real monitoring-sweep fairness bug this phase's own change
would otherwise have made worse at scale, and found — via real production Lighthouse
re-measurement — that the RISK-033 page-performance gap had already closed before this phase
touched any frontend code. Every change is backed by a real, passing test against real D1 (this
repo's Miniflare-backed integration harness) or real production evidence (Cloudflare MCP), not
assumption. Full `pnpm verify:push` (format, lint, typecheck, unit, integration, build, 103 E2E +
97 accessibility Chromium tests, secret scan) passes clean.

## Starting point

- Baseline commit: `84c4a59` (main, "docs: record production deployment of brand refresh and
  pricing fix"), confirmed matching the deployed production Worker before this phase began.
- Prior capacity/risk documents (`D1_STORAGE_CAPACITY_AUDIT.md`, `SCAN_CAPACITY_BUDGET.md`,
  `MONITORING_CAPACITY_PLAN.md`) were built from Phase 5-era estimates, explicitly flagged in
  their own text as needing re-verification against real production data — this phase's Stage 11A
  did exactly that.
- Six risks targeted for closure/mitigation: RISK-005, RISK-006, RISK-007, RISK-008, RISK-009,
  RISK-033. RISK-001, legal risks, Search Console risk, and Phase 8–10 risks were explicitly out
  of scope.

## Measurement methodology

Every quantitative claim in this phase traces to one of: a read-only Cloudflare MCP query against
real production D1/Workers/R2 (`docs/performance/PHASE_11_PRODUCTION_CAPACITY_BASELINE.md`), a
real Lighthouse run against `https://crawlpact.com` via a real headless Chrome instance (this
phase's own root-cause investigation), or a real integration test against this repo's Miniflare D1
harness. Where a claim could not be obtained this way (Cloudflare account plan, Worker CPU-limit
error counts, build bundle size, D1 database size — all discovered this phase to be unreachable
from inside a running Worker), it is recorded as such, not estimated or fabricated
(`docs/operations/PHASE_11_OPERATIONAL_CAPACITY_VIEW.md`).

## Database integrity (RISK-005, RISK-009)

- Migration `0022`: `scan_diffs.previous_scan_id`/`current_scan_id` now nullable with
  `ON DELETE SET NULL` (was `NOT NULL`, no `ON DELETE` clause — would have aborted the daily
  retention purge the first time an expired scan had a real diff referencing it).
- Migration `0023`: found during the same audit, not in the original risk register —
  `audit_continuations.scan_id` now `ON DELETE CASCADE` (was `NOT NULL`, no `ON DELETE`). A new
  primary cleanup path (`purgeExpiredAuditContinuations`) purges expired continuations directly;
  the cascade is a safety net.
- `docs/data/PHASE_11_FOREIGN_KEY_AND_DELETION_AUDIT.md`: every FK touching a table real code
  actually deletes from, classified as fixed/correct-as-is/latent-not-triggered — nothing changed
  speculatively.
- RISK-009: `listSubscriptions`/`listTransactions` (`lib/admin/subscriptions.ts`) changed from
  `INNER JOIN users` to `LEFT JOIN` — a deleted account's billing history is now visible to admins,
  labelled "Deleted account" rather than silently dropped from the list.
- Tests: `data-retention.integration.test.ts`, `admin-billing.integration.test.ts` — real D1,
  including a hard-deleted user's rows still appearing correctly, and no leaked user id/PII.

## Write batching

`persist-scan.ts` rewritten from ~30–76 individual `await db.insert(...)` calls per scan to one
`db.batch()` call — D1's own atomic multi-statement primitive, which also closes a real gap: there
was previously a window where a `scans` row could exist without its resource/finding rows if a
later insert failed. Real measured evidence:
`docs/performance/PHASE_11_SCAN_PERSISTENCE_BENCHMARK.md` (5 real scans against the controlled
e2e-fixture domain, local Miniflare D1: avg 90.26ms, min 67.38ms, max 118.79ms for the batched
persist step) plus an exact code-derived statement-count reduction (~33:1 typical, ~76:1 worst
case).

## Storage (RISK-007)

- `html_meta`: was up to 100,000 bytes of raw homepage HTML per row (measured production average
  53,554 bytes — 5.4× the old estimate). Now a minimised JSON evidence blob
  (`buildHtmlMetaEvidence`: three extracted fields, a 2,000-byte bounded snippet, truncation
  state, parser version). Old raw-HTML rows remain fully readable via a format-detecting fallback
  — no destructive rewrite.
- `sitemap`: was up to 100,000 bytes of raw XML (measured average 20,891 bytes — 13.9× the old
  estimate), even though nothing ever read it back. Now stores the already-computed
  `SitemapValidation` result.
- `resource_hash` (previously unused) now populated (SHA-256 of the real fetched body) for every
  fetched resource — for future change-detection use;
  `docs/data/PHASE_11_RESOURCE_HASH_AND_DEDUPLICATION_POLICY.md` records why cross-scan
  deduplication itself is deferred (a real, larger design decision, not yet justified by measured
  duplication rates).
- Findings cap: `MAX_PERSISTED_FINDINGS = 25`, severity-first + code-diversity selection
  (`selectFindingsForPersistence`), `findingsOmittedCount` disclosed in the API contract and the
  report UI — provably cannot affect scoring (capping happens strictly after score computation).
- Parser bounds: RSL and sitemap parsers now have the same 200,000-byte pre-parse bound HTML
  already had, closing the one previously-unbounded resource type.
- Tests: 24 signal-parser unit tests, 6 storage-reduction integration tests (new-format round
  trip, real size reduction, hash format, legacy-row backward compatibility), 12
  `selectFindingsForPersistence` unit tests.

## Retention (RISK-006 assessed, not unilaterally closed)

- `docs/data/PHASE_11_RETENTION_DECISION_MATRIX.md`: every category the phase prompt named,
  classified against real code — `product_events`/`security_events`/`notifications` have no SRS-
  specified retention period (the SRS's own table is silent on them), so this phase records a
  recommendation (18mo/24mo/90-days-after-read respectively) rather than implementing one
  unilaterally, per the phase's explicit "implement only approved retention periods" boundary.
  RISK-006 stays **open**, not closed, pending that approval.
- `runDataRetentionPurge` hardened: every category now chunk-bounded
  (`RETENTION_CHUNK_SIZE`×`RETENTION_MAX_CHUNKS`, 500×20 default), supports a real `dryRun` mode
  (`wouldAffect` counts via real `COUNT(*)`, no data modified), and isolates each category's
  failure — one category throwing no longer aborts the others. A real logic bug (backlog falsely
  reported when the eligible count happened to be an exact multiple of the chunk size) was found
  and fixed by the phase's own test, not shipped.
- R2 orphan-cleanup (`POST /api/admin/settings/r2-orphan-cleanup`): bounded, D1-reference-verified,
  grace-period-protected, dry-run-by-default — mitigates the known bulk-revoke/account-deletion R2
  gap after the fact without fixing the source paths (recorded as still open).
- Tests: 13 real-D1 retention tests including dry-run, chunking-with-a-real-multiple-of-chunk-size
  edge case, and a genuine failure-isolation test (a real `DROP TABLE` against a throwaway
  harness); 2 R2 orphan-cleanup tests.

## Monitoring (RISK-008 assessed, not an active problem at current scale)

- Fairness fix: `claimDueDomains` now orders by `next_scan_at ASC` (confirmed via a real D1 probe
  that NULL sorts first) — before this phase, an equally- or more-overdue domain could be starved
  indefinitely behind earlier-created domains whenever the due backlog exceeded the batch cap.
- `docs/operations/PHASE_11_SCHEDULED_JOB_SEPARATION_DECISION.md`: real current topology (1 Cron
  Trigger, 3 jobs including the previously-undocumented `scheduled_plan_changes`), the real
  tradeoff of splitting vs bundling, and the concrete trigger for revisiting — not split this
  phase, since real measured contention doesn't exist yet.
- Batch default (`MAX_DOMAINS_PER_SWEEP = 20`) reassessed against real `scheduled_job_runs`
  history (largest real sweep: 4 domains) and left unchanged — no evidence justified lowering it.
- Test: a new fairness integration test proving the most-overdue domains win a constrained batch.

## Caching and queries

- `docs/data/PHASE_11_D1_QUERY_AND_INDEX_AUDIT.md`: real `EXPLAIN QUERY PLAN` evidence against
  production for every high-frequency query. One real inefficiency found — this phase's own new
  monitoring `ORDER BY` forced a `TEMP B-TREE` — fixed with a composite index (migration `0025`),
  verified locally to eliminate the temp sort. No index removed (none found unused).
- `docs/performance/PUBLIC_CACHE_POLICY.md`: deny-by-default `Cache-Control: private, no-store` on
  every SSR response (middleware), explicit public opt-ins only on individually-verified
  session-independent pages (`changelog.astro`, `scanner.astro`, `for/[slug].astro`). Cloudflare's
  Workers Cache feature itself deliberately **not enabled** — its real edge behavior can't be
  verified from this session's sandboxed environment, and enabling a Worker-wide caching flag
  without that verification is a real, unverified infrastructure-behavior change this phase
  declines to bundle in. `pricing.astro` explicitly excluded (session-dependent rendering).
- Tests: 8 middleware tests (real default behavior + static presence checks for the opt-ins).

## Public performance (RISK-033)

Real production Lighthouse re-measurement found every previously-failing page (`/`,
`/crawlers/amazonbot`, `/for/agencies`, `/platforms/cloudflare`) now scores 94–99 (was 71–90) with
LCP 1,579–2,940ms (was 3,300–5,070ms) — the gap had already closed before this phase's own changes,
evidenced honestly rather than claimed as this phase's fix
(`docs/performance/PHASE_11_PAGE_PERFORMANCE_ROOT_CAUSE.md`). The homepage's LCP element was
confirmed via Lighthouse's own breakdown to be a text paragraph, not the recently-added hero
image. One real, fixable finding (a render-blocking shared CSS bundle, 140–433ms) was deliberately
not applied — `inlineStylesheets: 'always'` would trade a single-page-load win for a real,
unmeasured multi-page-session cost on this content-heavy site. A genuine test-machine variance
finding (a previously-perfect control page also degraded on a later run in the same session) is
disclosed in full rather than hidden. `docs/performance/PERFORMANCE_BUDGETS.md` and
`scripts/lighthouse-check.mjs` now gate on the median of 3 runs (not 1), cover `/sample-report`
(a real, previously-uncovered template gap), and upload full per-run results as a CI artifact.

## Operational visibility

`GET /api/admin/capacity` (Stage 11H) — a real, `requireAdminSession`-gated, tested read endpoint
covering D1 table count, R2 object count, scan volume/cost, monitoring backlog, and retention job
health, all real live queries. Four metrics the phase prompt named (Cloudflare plan, Worker
CPU-limit errors, bundle size, and — discovered this phase — D1 database size itself, since
`PRAGMA page_count`/`page_size` are rejected by D1's binding API) are honestly reported `null`
with the reason recorded, never fabricated.

## Security

`docs/security/PHASE_11_DATA_AND_PERFORMANCE_THREAT_REVIEW.md` covers cache leaks, hash-collision
assumptions, retention-deleting-active-data, purge-job DoS, monitoring duplicate-execution/
starvation, operational-metric leakage, R2-orphan-cleanup-deleting-live-assets, parser resource
exhaustion, and migration partial failure — each with the real code path and the real test that
proves the mitigation, not an assertion.

## Validation

`pnpm verify:push` passed in full: format check, lint, typecheck (0 errors), unit tests (339
passing across 35 files), integration tests (real D1, dozens of new tests across FK/retention/
monitoring/storage/caching/capacity/R2-cleanup), `db:validate` (42 tables consistent between
migrations and schema), production build, 103 Chromium E2E tests, 97 Chromium accessibility tests,
secret scan (clean).

## Deployment

Merged (PR #86, squash-merged as `36166a4`) and deployed to production 2026-08-05, with explicit,
in-the-moment approval requested and given separately for both the merge and the deploy, matching
the exact pattern used for every prior phase. Production CI's own quality-gate re-run caught one
real bug PR #86's own CI run missed — a new test (`data-retention.integration.test.ts`'s failure-
isolation test, which spins up a second full Miniflare D1 harness inline) exceeded vitest's
5000ms default timeout on the production workflow's colder runner, though it passed both locally
and in the PR's own CI. Fixed with a targeted timeout increase (PR #87, squash-merged as
`fc3ef36`, no application logic changed) and re-deployed successfully. Deployed Worker version:
`7d1b4cc4-2232-4c21-9f91-5b154f94e5c2`.

**Independent post-deploy verification** (beyond the workflow's own smoke test): all four new
migrations confirmed applied via real production `PRAGMA foreign_key_list`/`sqlite_master`
queries (`scan_diffs`/`audit_continuations` FKs show the corrected `ON DELETE` behavior,
`scans.findings_omitted_count` exists, the new composite index exists; table count unchanged at
42, as expected). The new public-cache opt-ins and the deny-by-default header were independently
re-verified live via direct `curl` against production — `/for/agencies`, `/scanner`, `/changelog`
return `public, max-age=300`; `/pricing` (deliberately excluded), `/app/domains`, and
`/api/domains` (401 unauthenticated) all return `private, no-store`. `GET /api/admin/capacity`
returns `401` unauthenticated, as expected. See `CHANGELOG.md`'s 2026-08-05 entry for the full
evidence list.

**A real, disclosed limitation found during this deploy**: the preview environment
(`crawlpact-web-preview`) is separately missing `PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET` secrets,
causing `deploy-preview.yml`'s post-deploy binding-verification step (and therefore the Lighthouse/
smoke-test steps gated behind it) to fail — confirmed pre-existing via the same failure on the
three unrelated preview deploys immediately before this phase's merge, and unrelated to Phase 11's
own build/migrate/deploy steps, which all succeeded on preview. This meant Stage 11I's full preview
verification (Lighthouse against the deployed preview, a live monitoring/retention dry-run against
synthetic preview data) could not be completed as originally planned — disclosed here rather than
silently skipped. Production's own secrets and binding verification are unaffected. Fixing the
preview secrets gap requires a real secret value this session does not have access to; routed to a
separate follow-up.

## Risk closure

| Risk     | Disposition                                                                                                                                                                                                                                        |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RISK-005 | **Closed** — both FK defects fixed, migration + real tests proving the fix.                                                                                                                                                                        |
| RISK-006 | **Open, assessed** — decision matrix written, recommendation recorded, implementation deferred pending approval per the phase's own scope boundary.                                                                                                |
| RISK-007 | **Substantially mitigated** — the two dominant contributors reduced ~2 orders of magnitude; not "closed" until a post-deploy production re-measurement confirms the real effect.                                                                   |
| RISK-008 | **Assessed, not closed** — real evidence confirms no active problem at current scale; concrete mitigations (batching, fairness, chunking) shipped; the underlying commercial-scale risk remains structurally real per its own acceptance criteria. |
| RISK-009 | **Closed** — `LEFT JOIN` fix, real test proving no PII leak and correct labelling.                                                                                                                                                                 |
| RISK-033 | **Recommend closing** — real re-measurement shows the gap already closed; historical root cause not definitively isolated (disclosed, not claimed).                                                                                                |

## Runtime-impact statement

No pricing, Paddle integration, crawler-evaluation logic, or monitoring cadence was changed by
this phase. Every user-visible change is additive (findings-cap disclosure banner, deleted-account
labelling in admin billing views) or invisible to end users (storage format, batching, caching
headers, index). No SRS requirement was narrowed, skipped, or silently reinterpreted.

## Next-phase-8 starting point

Phase 11 is merged and deployed to production (2026-08-05, Worker version
`7d1b4cc4-2232-4c21-9f91-5b154f94e5c2`), with independent post-deploy verification confirming no
regression — see "Deployment" above. Stage 11I's full preview-environment verification (Lighthouse
against the deployed preview, live monitoring/retention dry-runs against synthetic preview data)
could not be completed due to a disclosed, pre-existing, unrelated preview-secrets gap; production
itself is unaffected and independently verified. **Phase 8 is clear to begin.**
