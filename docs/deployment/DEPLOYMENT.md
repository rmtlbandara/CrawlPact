# Deployment

**No deployment has occurred.** This document describes the intended manual process; it is not
a record of anything that has actually run yet, and no deploy may happen without the user's
explicit, in-the-moment permission (project rule).

## Preconditions before any deploy is requested

1. `pnpm quality` passes locally and in CI.
2. `wrangler d1 migrations apply --remote` has been run against the target environment's
   database and reviewed.
3. Required secrets are set for the target environment (`wrangler secret put`, see
   `docs/deployment/CLOUDFLARE_CONFIGURATION.md`).
4. For production specifically: the relevant SRS acceptance criteria for whatever is being
   shipped (SRS §36) are met, not just "the build succeeds."

## Steps (once permission is given)

```bash
pnpm install --frozen-lockfile
pnpm build
wrangler d1 migrations apply crawlpact-db --remote --config apps/web/wrangler.jsonc [--env preview]
wrangler deploy --config apps/web/wrangler.jsonc [--env preview]
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
  the full checklist. Do not enable a long-duration/preload HSTS policy until these are confirmed.
