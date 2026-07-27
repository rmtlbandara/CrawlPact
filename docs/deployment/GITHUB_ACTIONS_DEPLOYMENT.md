# GitHub Actions Deployment

Added 2026-07-27 (see `docs/architecture/adr/ADR-0007-DEPLOYMENT-PIPELINE.md` for the full
reasoning, including two live production bugs found while building this).

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
- Concurrency: a second dispatch while one is already running queues rather than cancelling the
  first (production deploys are never raced against each other).
- Steps: checkout at the given SHA → re-run the full quality gate (`pnpm release:check`) →
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
