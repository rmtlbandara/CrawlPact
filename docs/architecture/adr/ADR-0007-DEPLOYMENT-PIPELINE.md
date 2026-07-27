# ADR-0007: Deployment Pipeline — Build-Time Environment Selection, Two Controlled Workflows, Binding-Drift Verification

**Status:** Accepted
**Date:** 2026-07-27
**Owner:** Solo founder / Claude Code

## Context

Before this change, CrawlPact had no automated deployment path at all: `.github/workflows/ci.yml`
validates every push but never deploys, and every real production deploy so far was a manual
`wrangler deploy` run from a developer's own machine. A separate, unrelated mechanism — Cloudflare
Workers Builds' own Git integration on this repository — was _also_ attempting to build and deploy
on every push to `main`, using an auto-detected `npx wrangler deploy` command run from the
repository root. Both facts were previously undocumented.

## Decisions

### 1. GitHub Actions is the one authoritative deployment system

Cloudflare Workers Builds' Git integration is left in place but unused for now (a separate,
explicitly-authorized Cloudflare reconciliation step is required to disable it — see
`docs/status/KNOWN_RISKS.md`). Two new workflows, `.github/workflows/deploy-preview.yml` and
`.github/workflows/deploy-production.yml`, are the only paths that deploy from here forward.

### 2. Preview vs. production is selected at _build_ time, not deploy time

Investigating why Workers Builds' auto-detected deploy command failed on every run (`wrangler
deploy` run from the repo root instead of `apps/web/`) surfaced a second, more consequential fact:
`apps/web/wrangler.jsonc`'s `env.preview` block is only ever applied when the Astro build itself
is run with `CLOUDFLARE_ENV=preview` set. **`wrangler deploy --env preview` against the
Astro-generated `apps/web/dist/server/wrangler.json` does nothing** — that file is already a fully
flattened snapshot of _one_ environment (baked in at build time), and passing `--env` against it
silently deploys whatever it was built as. Confirmed with a real `--dry-run`: an
`--env preview` deploy against a config built without `CLOUDFLARE_ENV=preview` deployed
_production_ D1, production Paddle Live values, and the production Worker name — silently, with no
error.

Decision: `scripts/build.sh <preview|production>` sets `CLOUDFLARE_ENV=preview` only for the
preview target (there is no `env.production` block; the top level _is_ production, and setting
`CLOUDFLARE_ENV=production` explicitly fails the build, since no such named environment exists).
`scripts/deploy.sh` never passes `--env` to `wrangler deploy` under any circumstance.

### 3. `.dev.vars` contaminates every build's prerendered pages, regardless of shell env vars

While verifying the above, a live check of `https://crawlpact.com/` found the homepage — and by
extension every statically prerendered marketing page — shipping with a **"Local Development
environment" banner baked into the HTML**, despite the deployed Worker's actual runtime
`PUBLIC_APP_ENV` variable correctly reading `"production"`. Root cause, confirmed empirically: Astro's
Cloudflare adapter (`platformProxy: { enabled: true }`) resolves `getEnv()` during prerendering from
a machine's local `.dev.vars` file first, if one exists — completely independent of `process.env`,
`CLOUDFLARE_ENV`, or `wrangler.jsonc`. The current production deploy was built from a developer
machine that (correctly, for local development) has a `.dev.vars` file present. Rebuilding with no
`.dev.vars` present in the checkout — the same condition as a fresh CI runner — resolved this
without any code change.

Decision: `scripts/build.sh` refuses to run at all if `.dev.vars` exists anywhere in the checkout.
Preview and production builds must only ever happen from a clean checkout (a GitHub Actions
runner, never a developer's own machine). This is enforced in the script itself, not only by
convention, so running `pnpm build:production` locally by mistake fails loudly instead of silently
shipping a contaminated build.

### 4. Static/prerendered pages need their own security headers

The same live check found prerendered pages carrying **no security headers at all** (no CSP, no
`X-Content-Type-Options`, no HSTS) — `middleware.ts` sets these correctly, but prerendered pages
are served directly off the Workers Assets binding and never run the Worker's middleware.
`apps/web/public/_headers` now carries the same header set for `/*`, mirroring `middleware.ts` by
hand (there is no single source both currently read from — keep them in sync manually when either
changes).

### 5. Binding-drift verification is a required, separate post-deploy step

`scripts/verify-bindings.ts` fetches the live deployed Worker's settings via the Cloudflare API
and compares vars/secret-presence/D1/KV/assets bindings against `apps/web/wrangler.jsonc`. This
exists specifically to prevent a repeat of the historical regression where Paddle price IDs and the
client token existed in `wrangler.jsonc` but not on the deployed Worker. It never reads or prints a
secret _value_ — only whether an expected secret _name_ is present as `secret_text`. It does not
yet verify the cron trigger (the Workers settings API used here doesn't expose it) — tracked as an
accepted gap in `docs/status/KNOWN_RISKS.md`.

## Consequences

- A `pnpm build:preview`/`build:production` + `pnpm deploy:preview`/`deploy:production` pair is now
  the only correct way to deploy, and both refuse to run under exactly the conditions that produced
  the two live bugs above.
- Production deployment still requires an explicit `workflow_dispatch` with a typed confirmation
  and a commit SHA verified to be contained in `main` — this ADR does not change CLAUDE.md's
  requirement for explicit, in-the-moment human authorization before any real production deploy.
- GitHub branch protection and Environment required-reviewer approval are unavailable on this
  repository's current plan (private repo, GitHub Free) — the typed `workflow_dispatch`
  confirmation is the practical substitute until/unless the plan changes.
