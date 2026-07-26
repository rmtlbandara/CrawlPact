# Cloudflare Environment Matrix

Current-state snapshot as of 2026-07-26 (first real deployment). Resource **IDs** are not secrets
(D1 database IDs and KV namespace IDs are not sensitive — Cloudflare account access, not knowledge
of an ID, is what gates use of them) so they're recorded here for operational reference. **Secret
values are never recorded in this file or any other repo file.**

| | Local | Preview | Production |
| --- | --- | --- | --- |
| Worker name | n/a (`astro dev` / `wrangler dev`) | `crawlpact-web-preview` | `crawlpact-web` |
| URL | `http://localhost:4321` | `https://crawlpact-web-preview.<account>.workers.dev` | `https://crawlpact.com` |
| D1 database | on-disk SQLite (`--local`) | `crawlpact-db-preview` (`e9c9f730-1f0d-4f4e-8775-db94126b12f0`) | `crawlpact-db` (`dd295b75-7376-4f05-8c50-fb0a63cc3cee`) |
| D1 binding | `DB` | `DB` | `DB` |
| KV namespace | none | `crawlpact-web-preview-session` (`6c940efc0991477a88fa9f730c53b476`) | `crawlpact-web-session` (`e092c1f4171243cf801b5af24070dfca`) |
| KV binding | none | `SESSION` (adapter-required, see `CLOUDFLARE_CONFIGURATION.md` — not used by app code) | `SESSION` (same) |
| Cron | not applicable | attached (`0 3 * * *`), but `AUDIT_ENGINE_ENABLED=false` so the monitoring sweep no-ops; retention purge still runs | attached (`0 3 * * *`), same gating |
| Paddle mode | sandbox | sandbox | production |
| `PUBLIC_APP_ENV` | `local` | `preview` | `production` |
| `PUBLIC_SITE_URL` | `http://localhost:4321` | `https://preview.crawlpact.com` (**placeholder — real value should be the workers.dev URL above until a real preview domain exists**) | `https://crawlpact.com` |
| `WEBAUTHN_RP_ID` | `localhost` | `preview.crawlpact.com` (**placeholder, same issue**) | `crawlpact.com` |
| `WEBAUTHN_RP_ORIGIN` | `http://localhost:4321` | `https://preview.crawlpact.com` (**placeholder, same issue**) | `https://crawlpact.com` |
| `AUDIT_ENGINE_ENABLED` | `true` (`.dev.vars`) | `false` | `false` |
| Secret: `SESSION_SIGNING_SECRET` | local placeholder value (`.dev.vars`) | **Set** (2026-07-26, random) | **Set** (2026-07-26, random, distinct from preview) |
| Secret: `PADDLE_API_KEY` | local placeholder (`.dev.vars`) | **Not set** | **Not set** |
| Secret: `PADDLE_WEBHOOK_SECRET` | local placeholder (`.dev.vars`) | **Not set** | **Not set** |
| `PADDLE_PRICE_ID_SOLO/PRO/AGENCY` | local placeholders (`.dev.vars`) | **Not set** | **Not set** |
| `PUBLIC_PADDLE_CLIENT_TOKEN` | local placeholder (`.dev.vars`) | **Not set** | **Not set** |
| Deploy command | n/a | `CLOUDFLARE_ENV=preview pnpm --filter @crawlpact/web build && wrangler deploy --config apps/web/dist/server/wrangler.json` | `pnpm build && wrangler deploy --config apps/web/dist/server/wrangler.json` |

## Notes

- **Preview's `PUBLIC_SITE_URL`/`WEBAUTHN_RP_ID`/`WEBAUTHN_RP_ORIGIN` are placeholders that don't
  match preview's actual serving domain** (the `workers.dev` URL above) — until fixed, preview
  passkey ceremonies will fail (the browser validates `rpId`/origin against the real page origin)
  and preview-generated absolute URLs (CSRF Origin check, Atom feeds, share links) will reference
  a domain that doesn't exist. Fix by updating `env.preview.vars` in `apps/web/wrangler.jsonc` to
  the real `workers.dev` hostname (or a dedicated preview custom domain, if one is added later).
- **Both environments have `workers_dev` enabled** (Wrangler's default when not explicitly set).
  Production has a working Custom Domain, so its `workers.dev` exposure is redundant — see
  `CLOUDFLARE_CONFIGURATION.md`'s dashboard checklist. Preview currently depends on it.
- The `SESSION` KV binding exists solely to satisfy `@astrojs/cloudflare`'s own built-in session
  feature default — it is not read by any CrawlPact application code (real sessions are D1-backed,
  ADR-0004). See `CLOUDFLARE_CONFIGURATION.md` for the full explanation.
