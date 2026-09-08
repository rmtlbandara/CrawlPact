# Phase 22 — GSC-Driven SEO, Search Intent Ownership & High-Value Content Strengthening — Completion Report

**Verdict: PASS**

Analysis, intent-ownership resolution, and implementation are complete. This changeset was
subsequently deployed to Production with explicit, in-the-moment owner authorization and
independently verified live, closing the loop this report originally left open.

## Prerequisite (Section 1)

Phase 21 was already deployed to Production and independently verified live in this same session
(Worker `7641c131-3a10-4502-99ca-99a6733eb7d8`, commit `72414dd8`) before this Phase 22 prompt
arrived — the prompt's own snapshot describing Phase 21 as `READY_FOR_PRODUCTION_DEPLOYMENT` was a
few minutes stale relative to reality, not a genuine unmet gate. See
`docs/baseline/2026-09-08-phase22/README.md` for the full reasoning and
`PHASE_21_WHOLE_PRODUCT_UI_UX_RESPONSIVENESS_CONVERSION_OPTIMIZATION_COMPLETION_REPORT.md` (verdict
`PASS`) for the deployment record.

## Repository

- **Starting SHA**: `72414dd872286e73bf88885191913aaab5aeff81` (main, post-Phase-21).
- **Branch**: `docs/phase21-deployment-record` (continued from the pending Phase 21 docs commit,
  per the owner's explicit instruction — Phase 22's changes were appended to the same branch rather
  than opened separately).
- **Ending SHA (this changeset)**: `5d999ce` on the branch, merged into `main` as `9a2fe87ac9d72d847d3b08691d8eb67475472818` (PR #166).
- **PR / CI**: [PR #166](https://github.com/rmtlbandara/CrawlPact/pull/166) — CI passed, merged via `merge-when-green`.

## Deployment

Followed the same trusted workflow as Phases 20-21:

1. PR #166 opened (bundling this Phase 22 changeset with the pending Phase 21 deployment-record
   docs commit, per the owner's instruction) — CI passed, merged via `merge-when-green` into `main`
   at commit `9a2fe87ac9d72d847d3b08691d8eb67475472818`.
2. Preview redeployed automatically for that commit — full pipeline green, including the Lighthouse
   budget check (run `34244284830`, success).
3. **Production deployment**, explicitly authorized by the owner in this session: dispatched
   `deploy-production.yml` for commit `9a2fe87a` (confirmed an ancestor of `origin/main`, confirmed
   CI — including browser-smoke — had succeeded for that exact SHA). Every step passed: typed
   confirmation guard, ancestor check, CI-succeeded check, full quality-gate re-run, production
   environment-contract validation, build, migrations, reference-data seed, Worker deploy, binding
   verification, and the production smoke test. Run `34247233897`, **success**.
   - **Deployed Worker version**: `73373d98-cc3a-4342-83f5-8eff5e43f321`
   - **Build artifact checksum**: `4d6e9463b2eab9d81171d4d3932a14d088f1dd8717baebcaaa0248a0093822a7`
     (identical to Phase 21's deployment — this checksum covers only the Worker's deployment
     manifest/bindings, which neither phase's changes touched, not the page content)
4. **Independent post-deploy verification** (direct `curl` against `https://crawlpact.com`): home
   200 with no `X-Robots-Tag`/environment banner; `/crawlers/amazonbot/` 200 with the new "Related
   crawlers" section live; the new comparison guide
   (`/guides/amazonbot-vs-amzn-searchbot-vs-amzn-user/`) 200; `/crawlers/perplexity-user/` 200 with
   the corrected "generally ignores [robots.txt]" fact live; `robots.txt` correct (`Sitemap:` line,
   crawling allowed); `sitemap.xml` 200 with 80 URLs; Microsoft Clarity correctly gated (no script
   on a cookie-less first visit) with the CSP correctly including `clarity.ms`/`c.bing.com`.

## GSC evidence

- **Property**: `sc-domain:crawlpact.com`. **Settled date**: 2026-09-06 (determined live via the
  API, not assumed).
- **28d**: 3 clicks, 888 impressions, 0.338% CTR, avg. position 61.56.
- **90d**: 6 clicks, 1,349 impressions, 0.445% CTR, avg. position 64.41.
- Full data-limitation disclosures (query truncation, canonical normalization, no search-volume
  mislabeling, no fixed-rank claims, no CTR-without-position conclusions) — see
  `docs/baseline/2026-09-08-phase22/GSC_BASELINE.md`.
- **Device/country**: captured in the raw export; no anomaly found worth a separate narrative this
  phase.

## Generative AI Search

- **Report availability**: `GENERATIVE_AI_REPORT_NOT_EXPOSED_TO_CURRENT_API_TOOLING` — verified
  directly against the live Search Analytics API's own discovery schema (the `type` enum has no
  generative-AI-specific value). `searchAppearance` dimension queried for both 28d/90d: 0 rows.
- **Inclusion control state**: `UNVERIFIED` — not exposed to this session's read-only OAuth scope;
  not guessed, not changed.
- See `docs/baseline/2026-09-08-phase22/GENERATIVE_AI_SEARCH_VISIBILITY.md` for the full record.

## Opportunity analysis

- **Near-win**: `/platforms/vercel/` (re-verified, no change), `/guides/metas-four-crawlers-explained/`
  (reviewed, no change — query data too sparse to act on), `/methodology/` (not reviewed in depth).
- **Emerging**: `/crawlers/amzn-searchbot/`, `/crawlers/amzn-user/` — both strengthened.
- **Deep visibility**: `/tools/robots-txt-ai-validator/` (358 90d impressions, the site's highest —
  classified `CONTENT_READY–AUTHORITY_LIMITED`, handed to Phase 23, no content change),
  `/crawlers/amazonbot/` (strengthened for differentiation, not for position).
- **CTR opportunity**: none found — every high-impression page sits too deep in results for CTR to
  be diagnostic (Section 14).
- **Intent conflicts**: Amazon cluster (resolved via differentiation + new guide), Perplexity
  cluster (reviewed, real factual correction made instead of a structural change).
- **Indexing follow-ups**: `/platforms/`, `/audit/` — both technically healthy, still "unknown to
  Google"; `MONITOR`.

Full detail: `docs/baseline/2026-09-08-phase22/SEO_OPPORTUNITY_REGISTER.md`.

## Search-intent ownership

Two clusters analyzed in depth (both explicitly required by the phase prompt): Amazon and
Perplexity. Both now have an explicit, documented intent owner and supporting-page relationship.
No merge was performed for either — evidence supported differentiation, not consolidation, in both
cases. Full detail: `docs/baseline/2026-09-08-phase22/SEARCH_INTENT_OWNERSHIP.md`.

## Content

- **Pages reviewed**: 7 directly (`/tools/robots-txt-ai-validator/`, `/platforms/vercel/`, and the
  5 Amazon/Perplexity crawler+guide pages), plus the full canonical-normalized page matrix
  (`GSC_CANONICAL_NORMALIZED_PAGE_MATRIX.md`) for triage.
- **Pages materially changed**: 6 (`amazonbot.md`, `amzn-searchbot.md`, `amzn-user.md`,
  `perplexitybot.md`, `perplexity-user.md`, `perplexitybot-vs-perplexity-user.md`).
- **Pages deliberately left unchanged after review**: `/platforms/vercel/` (re-verified accurate),
  `/tools/robots-txt-ai-validator/` (CONTENT_READY–AUTHORITY_LIMITED).
- **New pages**: 1 (`amazonbot-vs-amzn-searchbot-vs-amzn-user.md`) — passed the strict 10-criterion
  new-page gate; a second candidate (`/platforms/nextjs/`) was evaluated and **rejected** (see
  `PHASE_22_DECISIONS.md`).
- **Pages merged**: none.
- Full change-by-change record with sources/evidence: `docs/baseline/2026-09-08-phase22/CONTENT_CHANGE_REGISTER.md`.

## Crawler clusters

- **Amazon**: genuine 3-way query ambiguity found and resolved via differentiation + a new
  comparison guide. Two real, previously-undocumented facts added from Amazon's own current docs:
  `Amzn-SearchBot`'s fallback-to-other-search-bots behaviour, and `Amzn-User`'s documented
  robots.txt non-compliance.
- **Perplexity**: reviewed; evidence too thin for a structural conclusion. **Real factual
  inaccuracy found and fixed**: `perplexity-user.md` previously stated a standard `Disallow` rule
  applies; Perplexity's own current documentation states this fetcher "generally ignores
  robots.txt rules." Propagated the correction into `perplexitybot.md` and the existing comparison
  guide too.
- No other crawler clusters were reviewed this phase (no phase-prompt mandate, no anomalous GSC
  evidence for any other multi-token operator family).

## Metadata

- `lastVerified`/`platformDocsVerifiedDate` bumped only where a real primary-source recheck
  occurred this phase (6 crawler pages + Vercel platform guide) — never routinely.
- `summary` fields updated on `amzn-user.md` and `perplexity-user.md` to carry the corrected
  robots.txt-compliance fact.
- No title/description changed for SEO-score reasons; no arbitrary character-count enforcement.

## Internal linking

A real, previously-undiscovered gap: Phase 20's canonical trailing-slash sweep never touched
Markdown content-collection files. Found and fixed across 49 files, with a new automated
regression check in `scripts/content-validate.mjs` (verified to actually catch the regression
before being relied upon — see Quality gate below). Full detail:
`docs/baseline/2026-09-08-phase22/INTERNAL_LINK_DELTA.md`.

## Source verification

Every factual change this phase traces to a fresh fetch of the operator's own current
documentation, performed in-session (not from model memory):

- `https://developer.amazon.com/amazonbot` (Amazon cluster).
- `https://docs.perplexity.ai/guides/bots` (Perplexity cluster).
- `https://vercel.com/kb/guide/are-vercel-preview-deployment-indexed-by-search-engines` (Vercel
  re-verification).
- `https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-csp` and
  `.../consent-mode` (Microsoft Clarity CSP/consent-API investigation).

No conflicts between sources were found this phase requiring the "prefer more recent/specific,
else disclose ambiguity" fallback.

## Scaled-content defense

- New-page gate applied to both the approved page (Amazon comparison guide, passed) and the
  rejected candidate (`/platforms/nextjs/`, failed on 3 of 10 criteria) — see
  `PHASE_22_DECISIONS.md`.
- Similarity review across the Amazon/Perplexity crawler pages: no near-duplicate content found;
  differentiation _increased_ as a result of this phase's changes (see
  `docs/baseline/2026-09-08-phase22/CONTENT_DIFFERENTIATION_AUDIT.md`).
- No location/audience/platform keyword-permutation pages created.

## Microsoft Clarity (Section 112 addendum)

Implemented with the same production-only, consent-gated, marketing-allowlist architecture as the
existing Google Analytics integration — `shouldRenderClarity` is literally assigned
`shouldRenderGa`, not a parallel check. Found and fixed a real gap during implementation: the
existing consent UI's client-side "Accept" handler only loaded GA immediately, not Clarity (Clarity
would otherwise only have started on the visitor's _next_ page load). CSP updated with Microsoft's
own documented minimum origins. Privacy policy and consent-banner copy updated to disclose both
providers accurately. Full detail: `docs/baseline/2026-09-08-phase22/MICROSOFT_CLARITY_INTEGRATION.md`.

## Quality gate

| Check                                                                                                                                   | Result                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run format:check`                                                                                                                 | ✅ Pass                                                                                                                                                                                                                                                                                                                                           |
| `pnpm run lint`                                                                                                                         | ✅ Pass (`--max-warnings=0`)                                                                                                                                                                                                                                                                                                                      |
| `pnpm run typecheck`                                                                                                                    | ✅ Pass (0 errors; fixed 5 real type errors introduced by the Clarity client-loader code before this)                                                                                                                                                                                                                                             |
| `pnpm run test:unit`                                                                                                                    | ✅ 538/538 passed (+7 new: Clarity boundary tests)                                                                                                                                                                                                                                                                                                |
| `pnpm run test:integration`                                                                                                             | ✅ 390/390 passed, 56/56 files — a fully clean run (no Miniflare contention this time)                                                                                                                                                                                                                                                            |
| `pnpm run db:validate`                                                                                                                  | ✅ 56 tables consistent                                                                                                                                                                                                                                                                                                                           |
| `node scripts/content-validate.mjs`                                                                                                     | ✅ Pass — including the new internal-link canonicalization check, verified to actually fail on a deliberately-reintroduced bad link before being trusted                                                                                                                                                                                          |
| `pnpm run build`                                                                                                                        | ✅ Succeeds                                                                                                                                                                                                                                                                                                                                       |
| `pnpm exec playwright test apps/web/tests/e2e/responsive-smoke.spec.ts apps/web/tests/e2e/analytics-consent.spec.ts --project=chromium` | ✅ 49/49 passed                                                                                                                                                                                                                                                                                                                                   |
| `pnpm exec playwright test --config=playwright.a11y.config.ts --project=chromium` (targeted: touched pages)                             | ✅ 11/11 passed                                                                                                                                                                                                                                                                                                                                   |
| `pnpm exec playwright test --config=playwright.a11y.config.ts --project=chromium` (full suite, 111 tests)                               | ✅ 109/111 passed — the 2 failures are the identical, already-documented `AUDIT_ENGINE_ENABLED`/local-`.env` limitation Phase 21's completion report recorded (a real scan against `e2e-fixture.crawlpact.com` cannot complete locally without a `.env` this working copy doesn't have); neither failing test touches any file changed this phase |

**Local environment notes** (both diagnosed to a specific, verified root cause — not left as
unexplained flakiness):

- Two axe-scan failures on `/crawlers/amazonbot` and `/platforms/vercel` were traced to a stale
  Vite SSR dependency-optimizer cache after adding a new content-collection file to a dev server
  that had been running continuously since earlier in this session (6+ hours) — the actual error
  was a Vite "file does not exist in the optimize deps directory" 500, surfaced through axe as a
  violation on Vite's own error-overlay markup, not a real accessibility defect in CrawlPact's
  content. Resolved by restarting the dev server (`astro dev stop` + fresh start); re-ran clean.
- Two WebAuthn fixture-setup timeouts were traced to the same pre-existing, already-documented
  Miniflare/wrangler local dev-server instability this codebase's own `docs/risks/ACTIVE_RISKS.md`
  records (RISK-013's surrounding notes) — resolved by a fresh dev-server restart; re-ran clean
  (390/390 integration tests, 49/49 e2e tests, all subsequently green).

## Preview

Not yet deployed this phase — pending PR/CI/merge, following the same trusted workflow used for
Phases 20-21. Preview search isolation (`X-Robots-Tag: noindex`), canonical policy, and analytics
architecture are all unmodified by this phase's changes except the additive Microsoft Clarity
integration, which itself respects Preview's non-production gate identically to GA.

## Production

Not authorized this turn. Per `CLAUDE.md` and this phase's own Section 90.

## Measurement

T0 recorded (`GSC_BASELINE.md`, settled 2026-09-06). T+7/T+28/T+56 checkpoints planned in
`PHASE_22_DECISIONS.md` — not yet reached; no outcome claimed.

## Phase 23 handoff

- `/tools/robots-txt-ai-validator/` — `CONTENT_READY–AUTHORITY_LIMITED`. Highest-impression page on
  the site (358 90d impressions), content already answers the generic robots.txt-validator intent
  well, deep position (63-99) reflects competing against established high-authority generic tools.
  Needs distribution/authority work, not more content.
- `/crawlers/amazonbot/` — similarly deep-visibility (position 65.2) despite genuine differentiation
  work this phase; same authority-limited pattern.
- Brand-query demand remains at zero surfaced rows (unchanged since Phase 20) — per the phase
  prompt's own Section 77, this belongs to Phase 23's distribution/brand-growth work, not
  on-page content changes.

## Remaining risks

- `/platforms/` and `/audit/` remain un-crawled by Google (`INDEXING_FOLLOW_UP.md`) — evidence-backed
  as a young-site crawl-budget pattern, not a technical defect, but genuinely unresolved pending
  Google's own recrawl timeline.
- The Amazon/Perplexity content changes have not yet had time for Google to reprocess — no ranking
  outcome is knowable yet (Section 92).
