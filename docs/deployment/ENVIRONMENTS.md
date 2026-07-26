# Environments

| Environment | `PUBLIC_APP_ENV` | D1 database                              | Paddle                     | Deployed via                                                             |
| ----------- | ---------------- | ---------------------------------------- | -------------------------- | ------------------------------------------------------------------------ |
| Local       | `local`          | `--local` sqlite file under `.wrangler/` | Sandbox (placeholder keys) | `astro dev` / `wrangler dev`                                             |
| Preview     | `preview`        | Separate preview D1 database             | Sandbox                    | `wrangler deploy --env preview` (manual, not yet in CI)                  |
| Production  | `production`     | Production D1 database                   | Production                 | `wrangler deploy` (manual, requires explicit approval — never automatic) |

## Environment indicators (SRS §10.43)

`PUBLIC_APP_ENV` is read from the Worker's `vars`. A non-production value renders a persistent
environment label in the UI — implemented in `BaseLayout.astro` at Part 3 Step 26, covering every
page (public, app, and admin, since all three share that layout). Production shows no label.

## Config precedence

1. `wrangler.jsonc` `vars` (non-secret, committed, environment-specific under `env.<name>`)
2. `wrangler secret put` (secret, per-environment, never committed)
3. `.dev.vars` (local only, gitignored, mirrors `.env.example`)

All of the above are validated at boot via `packages/config`'s `parseEnv` — an environment
missing a required variable fails fast with every missing field listed, not just the first.

## No CI deploy step

CI (`.github/workflows/ci.yml`) builds and validates every environment's configuration
statically but never runs `wrangler deploy`. Deployment remains a deliberate, manual, permitted
action per the project's operating rules.
