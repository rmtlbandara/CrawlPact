# Cloudflare Configuration

## Bindings (`apps/web/wrangler.jsonc`)

| Binding  | Type                  | Purpose                                                                           |
| -------- | --------------------- | --------------------------------------------------------------------------------- |
| `DB`     | D1 database           | Primary datastore (ADR-0002) — **a distinct database per environment**, see below |
| `ASSETS` | Workers Static Assets | Astro's built static output                                                       |

## Required manual setup before first deploy to a real Cloudflare account

Production and preview each need their **own** D1 database — never point both at the same
`database_id`. This was a real gap found and fixed in Part 3 Step 26 (`env.preview` previously had
no `d1_databases` block at all and silently inherited production's).

```bash
wrangler d1 create crawlpact-db
# copy the returned database_id into apps/web/wrangler.jsonc's top-level
# d1_databases block, replacing the 00000000-0000-0000-0000-000000000000 placeholder

wrangler d1 create crawlpact-db-preview
# copy the returned database_id into apps/web/wrangler.jsonc's env.preview.d1_databases
# block — a DIFFERENT id from the one above
```

Then apply migrations (and, for preview only, seed data if you want realistic test data) to each:

```bash
wrangler d1 migrations apply crawlpact-db --remote --config apps/web/wrangler.jsonc
wrangler d1 migrations apply crawlpact-db-preview --remote --config apps/web/wrangler.jsonc --env preview
```

## Non-secret environment vars that must be set correctly per environment

`wrangler.jsonc`'s `vars` (top-level for production, `env.preview.vars` for preview) — these
aren't secrets, but getting them wrong breaks real functionality, not just cosmetics:

- `PUBLIC_SITE_URL` — used by the CSRF Origin check, Atom feed URLs, and share links. If preview
  silently inherits production's value, preview-generated links/CSRF checks reference the wrong
  domain.
- `WEBAUTHN_RP_ID` / `WEBAUTHN_RP_ORIGIN` — **passkey auth fails outright for every user if these
  don't exactly match the domain the app is actually served from**, since the browser strictly
  validates `rpId`/origin against the real page origin during the WebAuthn ceremony. Update both
  the moment a real preview domain (or a production domain change) is known — the current
  `preview.crawlpact.com` values in `wrangler.jsonc` are placeholders.

## Secrets (never in `wrangler.jsonc`)

Set per environment with `wrangler secret put <NAME> --config apps/web/wrangler.jsonc [--env
preview]`:

- `SESSION_SIGNING_SECRET`
- `PADDLE_API_KEY`
- `PADDLE_WEBHOOK_SECRET`

## Cron Triggers

Declared in `wrangler.jsonc` under `triggers.crons` (`["0 3 * * *"]`, daily at 03:00 UTC). Drives
both the monitoring sweep (`lib/monitoring.ts` — re-scans domains whose monthly/weekly schedule is
due) and the data-retention purge (`lib/data-retention.ts`) via `src/worker.ts`'s `scheduled()`
export — both are real, implemented, tested logic, not a placeholder.

## Compatibility

`compatibility_date` is pinned (`2026-07-01`) and `nodejs_compat` is enabled, required for
`@simplewebauthn/server` and `@paddle/paddle-node-sdk`. Bump `compatibility_date` deliberately,
not automatically, and re-run the full test suite after doing so.

## Custom domains / DNS

Not yet configured — no production Cloudflare account has been connected to this repository.
