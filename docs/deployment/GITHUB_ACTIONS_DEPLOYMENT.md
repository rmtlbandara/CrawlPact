# GitHub Actions Deployment

Added 2026-07-27 (see `docs/architecture/adr/ADR-0007-DEPLOYMENT-PIPELINE.md` for the full
reasoning, including two live production bugs found while building this).

## Incidents found and closed since (2026-07-29 release-flow remediation)

Two real, previously-undocumented gaps in this pipeline were found and fixed — recorded here
rather than only in `docs/status/KNOWN_RISKS.md`, since both are directly relevant to trusting
this deployment path:

- **Cloudflare Workers Builds (a separate, dashboard-configured Git-integration product, unrelated
  to the GitHub Actions workflows below) had two active triggers silently deploying
  `crawlpact-web` straight to production on every push to `main`** — completely bypassing
  `deploy-production.yml`'s typed-confirmation gate. Confirmed via Workers Builds' own history:
  a build had deployed `main`'s tip to production with zero relationship to a `workflow_dispatch`.
  Both triggers were deleted via the Cloudflare API; verified via Cloudflare MCP during this
  remediation that no Git-triggered build configuration exists for either `crawlpact-web` or
  `crawlpact-web-preview` — `deploy-production.yml` is confirmed to be the only production path.
- **`deploy-production.yml`'s own deploy step had a masked-exit-code bug**: `pnpm run
deploy:production | tee /tmp/deploy-output.txt` without `set -o pipefail` meant a real
  `wrangler deploy` failure was silently swallowed (`tee` always exits 0), so the workflow reported
  success even when nothing had actually deployed. Fixed by adding `set -o pipefail` before the
  pipe.

## Merge automation

`.github/workflows/merge-when-green.yml` is the release flow's auto-merge substitute — see its own
header comment for the full guard list (same-repo PR, owner-authored, targets `main`, carries an
`automerge` label, exact tested SHA, mergeable). Native GitHub auto-merge is deliberately **not**
enabled (`allow_auto_merge: false`): this repository is private on the GitHub Free plan, where
branch protection and rulesets both 403 — without branch protection to gate on, native auto-merge
would merge as soon as a PR is "mergeable," not necessarily after CI actually passes.

## Required GitHub secrets

Set under repo Settings → Secrets and variables → Actions, and referenced by both workflows below.
Only narrowly-scoped Cloudflare Workers deploy credentials — never Paddle runtime secrets, which
already live as Cloudflare Worker secrets and don't need to exist in GitHub at all.

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` — scoped to Workers Scripts (edit) and Workers KV/D1 as needed for
  `wrangler deploy` and `wrangler d1 migrations apply`. Not the account's Global API Key.

## `.github/workflows/deploy-preview.yml`

- Trigger: `workflow_run` — fires only after `.github/workflows/ci.yml` completes successfully on
  `main`. A commit that fails CI can never reach this workflow.
- Concurrency: cancels an in-flight preview deploy if a newer one starts, so an older commit can
  never overwrite a newer preview.
- Steps: install → `pnpm env:validate:preview` → `pnpm build:preview` → apply pending migrations
  to `crawlpact-db-preview` only (`--remote --env preview`) → `pnpm deploy:preview` →
  `pnpm deploy:verify-bindings preview` → `pnpm smoke:preview`.
- Uses the `preview` GitHub Environment, so every run is recorded in the repo's Deployments tab.
- On any step failure, the job fails and no later step runs — a failed smoke test after a
  successful deploy still marks the whole run failed.

## `.github/workflows/deploy-production.yml`

- Trigger: `workflow_dispatch` only, with two required inputs:
  - `commit_sha` — the exact commit to deploy.
  - `confirm` — must be typed exactly `DEPLOY PRODUCTION`, checked in the first step before
    anything else runs.
- The workflow independently verifies `commit_sha` is actually contained in `origin/main` before
  doing anything else — it does not trust the input blindly.
- It also independently verifies that the **actual recorded CI workflow run** for that exact
  commit succeeded — `pnpm release:check` (below) re-runs format/lint/typecheck/unit/integration/
  build fresh, but that script has never included e2e/a11y (they need a running dev server and
  Playwright browsers), so re-running it tells you nothing about whether `e2e-and-a11y` passed.
  Without this check, a red `e2e-and-a11y` on `main` would not have blocked this workflow at all —
  found while reasoning through what "ready for production" actually requires.
- Concurrency: a second dispatch while one is already running queues rather than cancelling the
  first (production deploys are never raced against each other).
- Steps: checkout at the given SHA → verify CI succeeded for that exact commit (including
  `e2e-and-a11y`) → re-run the full quality gate (`pnpm release:check`) →
  `pnpm env:validate:production` → `pnpm build:production` → record the build artifact checksum →
  apply pending migrations to `crawlpact-db` → `pnpm deploy:production` → record the Worker
  version ID (parsed from `wrangler deploy`'s own output) → `pnpm deploy:verify-bindings
production` → `pnpm smoke:production`.
- Uses the `production` GitHub Environment. **Required-reviewer approval on this environment is
  not currently configured** — GitHub's Environment protection rules for a private repository
  need a paid plan (this repo is on GitHub Free; confirmed via the API, see
  `docs/status/KNOWN_RISKS.md`). The typed `confirm` input is the practical substitute until that
  changes.
- Uploads `deploy-output.txt` and the built `wrangler.json` as a 90-day artifact for rollback
  reference.

## What neither workflow does

- Neither ever runs `wrangler secret put` — Worker secrets (`PADDLE_API_KEY`,
  `PADDLE_WEBHOOK_SECRET`, `SESSION_SIGNING_SECRET`) are provisioned out of band and preserved
  across deploys automatically (`wrangler deploy` never clears existing secrets).
- Neither passes `--env` to `wrangler deploy` — the preview/production distinction is made once,
  at the build step, via `CLOUDFLARE_ENV`. See ADR-0007 for why passing `--env` here would be
  actively wrong, not just redundant.
- Production is never deployed automatically on push. Only an explicit, typed `workflow_dispatch`
  can trigger it.

## Rollback

See `docs/release/ROLLBACK_RUNBOOK.md`.
