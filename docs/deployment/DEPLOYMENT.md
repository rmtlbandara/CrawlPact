# Deployment

**First deployment occurred 2026-07-26**, with the user's explicit, in-the-moment permission,
after a full Cloudflare account/zone reconciliation (see
`docs/deployment/CLOUDFLARE_CONFIGURATION.md` and `docs/deployment/CLOUDFLARE_ENVIRONMENT_MATRIX.md`
for current state). No deploy may happen without the user's explicit permission each time this
project rule applies regardless of any prior authorization.

## Preconditions before any deploy is requested

1. `pnpm quality` passes locally and in CI.
2. `wrangler d1 migrations apply --remote` has been run against the target environment's
   database and reviewed.
3. Required secrets are set for the target environment (`wrangler secret put`, see
   `docs/deployment/CLOUDFLARE_CONFIGURATION.md`).
4. For production specifically: the relevant SRS acceptance criteria for whatever is being
   shipped (SRS §36) are met, not just "the build succeeds."

## Steps (once permission is given)

**Build first, then deploy the build output's generated config — not the source `wrangler.jsonc`
directly.** See `docs/operations/RUNBOOK.md`'s "Deploying (manual)" section for the full
explanation of why (`main: "./src/worker.ts"` cannot be bundled standalone by Wrangler; Astro's
own build already resolves it into `dist/server/entry.mjs`).

```bash
pnpm install --frozen-lockfile

# Production:
pnpm build
wrangler d1 migrations apply crawlpact-db --remote --config apps/web/wrangler.jsonc
wrangler deploy --config apps/web/dist/server/wrangler.json

# Preview (note CLOUDFLARE_ENV, which selects env.preview's vars/D1/KV at build time):
CLOUDFLARE_ENV=preview pnpm --filter @crawlpact/web build
wrangler d1 migrations apply crawlpact-db-preview --remote --config apps/web/wrangler.jsonc --env preview
wrangler deploy --config apps/web/dist/server/wrangler.json
```

## Post-deploy verification

- Load `/` and `/status` on the deployed URL.
- Confirm `robots.txt` and `sitemap.xml` resolve.
- Confirm the environment indicator matches the target environment (see
  `docs/deployment/ENVIRONMENTS.md`).
- Check `scheduled_job_runs` after the next cron tick to confirm the Worker's `scheduled()`
  export is live.
- **Production only, first deploy to a real domain**: confirm `http://` redirects to `https://`,
  `www.crawlpact.com` redirects to the apex in exactly one hop (no loop), and the WebAuthn
  ceremony succeeds end-to-end against the real origin — see
  `docs/deployment/CLOUDFLARE_CONFIGURATION.md`'s "DNS, SSL, and domain configuration" section for
  the full checklist (all confirmed passing as of 2026-07-26). Do not enable a long-duration/
  preload HSTS policy until these are confirmed.

## 2026-07-26 deployment record

- **Discovered before this deploy**: the Cloudflare account already had the `crawlpact.com` zone
  active with a Worker Custom Domain attached to a placeholder `crawlpact-web` Worker (bare
  "Hello world", no bindings) — created earlier the same day, outside this repo's documented
  process. Two orphaned KV namespaces (`crawlpact-web-session`, `crawlpact-web-preview-session`)
  also pre-existed — see `docs/deployment/CLOUDFLARE_CONFIGURATION.md`'s "Astro's own session KV
  requirement" for why.
- **D1**: `crawlpact-db` (`dd295b75-7376-4f05-8c50-fb0a63cc3cee`) and `crawlpact-db-preview`
  (`e9c9f730-1f0d-4f4e-8775-db94126b12f0`) created; all 16 migrations applied to both (38 tables
  each, matching `pnpm db:validate`).
- **Secrets**: `SESSION_SIGNING_SECRET` set (distinct random value per environment).
  `PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET` intentionally left unset — no real Paddle account exists
  yet; billing routes will error if invoked until these are set.
- **Real bug found and fixed**: `wrangler.jsonc`'s `main: "./src/worker.ts"` cannot be deployed
  directly (Wrangler can't resolve Astro's internal virtual modules standalone) — this had been an
  unconfirmed suspicion in `docs/status/IMPLEMENTATION_STATUS.md`; now confirmed and documented in
  `docs/operations/RUNBOOK.md`. Fix: deploy `apps/web/dist/server/wrangler.json` (the build
  output's generated, already-bundled config) instead of `apps/web/wrangler.jsonc` directly.
- **Preview deployed and validated**: `crawlpact-web-preview.<account>.workers.dev` — real app
  serving correctly (`/status`, `robots.txt`, `sitemap.xml`, 404 handling all confirmed), cron
  attached, `SESSION_SIGNING_SECRET` confirmed to persist across the code deploy.
- **Production deployed and validated**: full canonical-hostname matrix passed (see
  `docs/deployment/CLOUDFLARE_CONFIGURATION.md`). Placeholder Worker replaced.
- **Not yet resolved**: Paddle secrets/vars (needs a real Paddle account — separate task); several
  zone-level settings need a manual dashboard check since this session's API token was read-only
  at the zone level (see `docs/deployment/CLOUDFLARE_CONFIGURATION.md`'s "Items that need a
  dashboard check", including Cloudflare's own AI Crawl Control robots.txt injection, which is
  particularly notable for a crawler-policy auditing product).
