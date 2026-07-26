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

## Object storage (R2)

**Not used.** See `docs/data/D1_R2_DATA_PLACEMENT_POLICY.md` (2026-07-26) for the evidence-based
decision not to adopt R2 at this time, and the concrete triggers that would reopen that decision.
No `r2_buckets` binding exists in `wrangler.jsonc`.

## DNS, SSL, and domain configuration (Phase 14)

**Not yet configured** — no production Cloudflare account has been connected to this repository.
This section records the _intended_ configuration for when a real account exists, so first setup
follows a checklist rather than being improvised.

### Domains

- `crawlpact.com` — canonical apex, production.
- `www.crawlpact.com` — must permanently redirect (301) to the apex, never serve independent
  content.
- `preview.crawlpact.com` (optional) — for the `env.preview` Worker environment. Currently a
  placeholder value in `wrangler.jsonc`'s `env.preview` block; must be replaced with the real
  domain before preview WebAuthn ceremonies will work (see "Non-secret environment vars" above).

### Required configuration once a real account exists

1. **Apex is canonical.** All redirects converge on `https://crawlpact.com`, never
   `https://www.crawlpact.com` or a bare-HTTP variant.
2. **HTTP → HTTPS redirect** enabled account-wide (Cloudflare's "Always Use HTTPS" setting).
3. **`www` → apex redirect**, permanent (301), configured as a Cloudflare redirect rule or page
   rule — verify it does not create a redirect loop with rule #1 (test both
   `http://www.crawlpact.com` and `https://www.crawlpact.com` resolve to `https://crawlpact.com`
   in exactly one hop).
4. **Universal SSL** active on the zone (Cloudflare's free, automatic certificate) — this is
   enabled by default for any zone added to Cloudflare and should simply be confirmed, not
   configured manually.
5. **DNS records proxied** (orange-cloud, not grey-cloud/DNS-only) for the apex and `www` — this
   is what puts Cloudflare's CDN, DDoS protection, and CSP/security-header injection in front of
   the Worker; a DNS-only record would bypass Cloudflare entirely for that hostname.
6. **HSTS**: do **not** enable a long-duration/preload HSTS policy until the redirect chain above
   (#1–#3) has been verified working end-to-end. Enabling HSTS before the domain/redirect strategy
   is confirmed risks locking out a misconfigured hostname for the duration of the `max-age` (and
   permanently, if preloaded) with no easy rollback. Start with a short `max-age` and no
   `preload`/`includeSubDomains` flag; extend only after confirming no unintended hostname is ever
   served over plain HTTP.
7. **WebAuthn RP ID and origin exactly match** the real serving domain — see the "Non-secret
   environment vars" section above; this is re-stated here because it is a DNS/domain-config
   precondition, not just an application config one.
8. **Preview isolation**: preview uses its own D1 database (`crawlpact-db-preview`, see above), no
   R2 (R2 isn't used by either environment — see above), Paddle **sandbox** credentials (never
   production Paddle keys), and cannot reach production data. Production and preview secrets
   (`SESSION_SIGNING_SECRET`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`) must be set independently
   per environment via `wrangler secret put ... --env preview` — never reuse a production secret
   value for preview.

### CDN caching

See `docs/deployment/CDN_CACHE_POLICY.md` for the full cache policy (what's safe to cache publicly
vs. never cached) — DNS/CDN configuration and cache-control policy are related but distinct
concerns; this section covers domain/routing/TLS, that document covers response caching.
