---
Document owner: Engineering owner
Status: current-authoritative (Phase 1, Workstream A/B)
Verified: 2026-09-17, via direct `gh api`/Cloudflare API/D1 reads — not carried forward from prior docs
---

# Git, GitHub, and Production Reconciliation — 2026-09-17

Every fact below was independently re-verified this pass (git, `gh api`, the Cloudflare API, and a
live D1 read against the production database), not copied from a prior document or from the
Phase 1 directive's own "known baseline" section (which explicitly asked not to be trusted
blindly).

## Git

- `main` HEAD: `5e4f12793cbf657120a3c4b0849d7ad6971caf4e` (PR #201, docs-only — Google Insights
  final live-validation closure evidence).
- Working tree was clean at the start of this pass.
- Local and `origin/main` were in sync.
- No open pull requests target `main` other than the 12 Dependabot PRs listed below (verified via
  `gh pr list --state open`).
- Many stale local branches exist whose remotes are `gone` (already merged/deleted) — left alone;
  cleaning up local-only branch refs is cosmetic and out of scope for this phase.

## GitHub repository state (verified live via `gh api`, not assumed)

| Fact                        | Prior assumption (per `merge-when-green.yml`'s own comment) | Verified live state                                                                                          |
| --------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Repository visibility       | "private on the GitHub Free plan"                           | **Public** (`private: false`, confirmed 4 ways including an unauthenticated `curl` to the public GitHub API) |
| Branch protection on `main` | N/A (assumed 403/unavailable because private+Free)          | Was **completely absent** (404 "Branch not protected") before this pass                                      |
| Rulesets on `main`          | N/A (assumed 403/unavailable)                               | Was an **empty list** before this pass                                                                       |
| Secret scanning             | Not previously checked                                      | Was **disabled** before this pass                                                                            |

**Repository visibility**: the owner has decided to keep the repository public on GitHub for now
(their own call to make, on their own timeline) but to continue treating its contents as
private/confidential in every action taken here, per Section 0 of the Phase 1 directive. No
content, architecture, or credential detail from this repository has been or will be disclosed on
the assumption that "it's already public" — that decision belongs to the owner alone.

**Fixed this pass** (both actions are safety-additive, reversible via the GitHub UI, and do not
touch application code, CI behavior, or the existing `deploy-production.yml`/`merge-when-green.yml`
automation — verified against `merge-when-green.yml`'s actual merge guard logic before applying):

- Added ruleset `main-protection` (id `23581741`) on `main`: blocks deletion, blocks non-fast-forward
  (force) pushes, and requires the `CI` check (the `ci-gate` job — the single stable aggregate check
  `ci.yml` itself documents as "the one stable, required aggregate check") to have succeeded.
  Verified safe against actual practice first: every one of the last 10 commits on `main` landed via
  a squash-merged, CI-gated PR (`gh pr list --state merged`), never a direct push, so this ruleset
  formalizes existing behavior rather than changing it.
- Enabled secret scanning and secret scanning push protection (`security_and_analysis` on the repo).

**Not changed**: repository visibility (owner's decision, deferred); `dependabot_security_updates`
(left off — the repository already receives version-update PRs via `dependabot.yml`, and enabling
this additionally is a reasonable Phase 2+ follow-up, not a Phase 1 blocker).

## Production, verified directly (not from docs)

Read directly from the Cloudflare API and a live (read-only) D1 query against the production
database — not from `docs/status/CURRENT_STATE.md`, which turned out to be stale (see below).

- **Live Worker**: `crawlpact-web`, current deployment version `ba8000c7-f3d2-4914-ad85-2969c1433ca3`
  (version #94), deployed `2026-09-16T05:54:14Z`, `source: "wrangler"` (i.e. via the guarded
  `deploy-production.yml` pipeline, not a manual dashboard deploy) — this is the build produced by
  PR #200 (Google Insights, merged `2026-09-16T05:31:35Z`); PR #201 (docs-only, merged
  `2026-09-17T02:34:35Z`) correctly triggered no redeploy.
- **D1 migrations applied to production**: 38/38, latest `0038_google_oauth.sql` — confirmed via a
  live `SELECT COUNT(*), MAX(name) FROM d1_migrations` against the production database
  (`dd295b75-7376-4f05-8c50-fb0a63cc3cee`). Migration `0039_growth_snapshots.sql` (added this pass,
  see `GOOGLE_GROWTH_CONTROL_PLANE.md`) has **not** been deployed to production.
- **Crawler registry**: exactly one published version exists in production, `2026.07.3`, published
  `2026-07-28` — confirmed via a live query against `registry_versions`. No registry release has
  shipped since Phase 17, consistent with `CURRENT_STATE.md`'s claim.
- **Google integration bindings**: `GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON`, `CRUX_API_KEY`,
  `GOOGLE_GA4_PROPERTY_ID` (`547512440`), `GOOGLE_SEARCH_CONSOLE_SITE_URL`
  (`sc-domain:crawlpact.com`), `CRUX_ORIGIN` (`https://crawlpact.com`) are all present as live
  Production bindings — confirmed via the Cloudflare API version-detail read, not assumed from
  `wrangler.jsonc`/`.env.example` alone.

### A finding worth flagging, not fixing unilaterally

The Worker's deployment history (`GET .../workers/scripts/crawlpact-web/deployments`) shows four
`source: "dash"` deployments on `2026-09-15`, in addition to the `wrangler`-sourced ones from the
guarded pipeline. These predate this session and were made by the account owner directly
(`author_email: rmtlbandara@gmail.com`) via the Cloudflare dashboard — bypassing
`deploy-production.yml`'s CI-gate/migration/smoke-test sequence entirely. The current live version
is a later, `wrangler`-sourced deployment, so production is not currently drifted from a
dashboard-only build. But there is no technical control preventing this from happening again — it
is a discipline question for whoever holds Cloudflare dashboard access, not something fixable via
an API call. Recommendation: avoid manual dashboard deploys going forward; always go through
`deploy-production.yml`, exactly as the phase directive itself specifies (§31).

## Documentation truth reconciliation

`docs/status/CURRENT_STATE.md`'s header block was stale: last verified 2026-09-08 (Phase 22),
citing commit `011b939...` and Worker version `5aacab1e...` — both superseded by the Google
Insights release (PR #200/#201) that shipped after that document was last touched. Corrected in
this pass (see the diff to that file) to cite the verified `5e4f127`/`ba8000c7` facts above, with
the review-frequency/next-review-date lines preserved. The narrative body of that document (the
long-form phase history) was not rewritten — only the authoritative header block, consistent with
the doctrine of leaving historical narrative alone and only ever correcting the "current state"
summary at the top.

## Local test-infrastructure note (not a code defect)

Running the entire `vitest run --project integration` suite unthrottled on this machine produced
sporadic `fetch failed` errors from Miniflare/workerd instances under heavy parallel load (dozens
of concurrent D1-backed harnesses). Re-running the exact same suite with `--maxWorkers=2` passed
cleanly: **57/57 integration test files, 399/399 tests**, including every test that failed under
full parallelism. This is a local resource-contention artifact of this specific machine's
concurrency headroom, not a regression — worth knowing if a future session sees the same
"different file fails every time" pattern and is tempted to chase it as a real bug.

## Dependency PRs — triage (Workstream C)

12 open Dependabot PRs, CI re-checked live (not assumed from PR age):

**CI fully green, safe to rebase-merge after a fresh CI run against current `main`:**

- #188 `deps-dev` group (7 dev-dependency bumps)
- #186 `zod` 4.4.3 → 4.6.2
- #184 `@simplewebauthn/server` 13.3.2 → 14.0.1
- #151 `@simplewebauthn/browser` 13.3.0 → 14.0.0
- #142 `@paddle/paddle-js` 1.6.4 → 1.6.5

Note: #184/#151 are a major version bump of the WebAuthn library pair — CLAUDE.md's own guidance
singles out SimpleWebAuthn major changes for extra caution. Both being green is necessary but not
sufficient; before merging, re-run the full quality gate plus a manual passkey
registration/authentication smoke test on Preview, and merge the server/browser pair together
(never one without the other, since their wire protocol is versioned as a pair).

**CI fails on both the quality job and the E2E/accessibility job — real, substantive breakage,
do not merge without investigation:**

- #187 `astro` 7.2.10 → 7.3.2
- #185 `@astrojs/cloudflare` 14.2.1 → 14.3.1
- #183 `react-dom` + `@types/react-dom` bump
- #136 `browser-actions/setup-chrome` 2.1.2 → 2.2.0 (CI-infrastructure action, stale since 2026-08-24)

**CI fails only on the E2E/accessibility job, quality passes — ambiguous, re-run against current
`main` before deciding (all three are stale, opened before several subsequent merges to `main`,
so this may be drift rather than a real regression):**

- #182 `lucide-react` 1.31.0 → 1.44.0
- #181 `pnpm/action-setup` 6.0.10 → 6.1.0
- #149 `@astrojs/react` 6.0.2 → 6.0.5

No dependency PR was merged in this pass — per §7 of the Phase 1 directive, upgrades are handled as
their own isolated, tested changes, not bundled into the growth-control-plane branch.
