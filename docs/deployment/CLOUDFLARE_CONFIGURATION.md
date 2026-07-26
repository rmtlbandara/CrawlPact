# Cloudflare Configuration

**Status as of 2026-07-26: a real Cloudflare account and zone are connected, and both environments
are deployed.** See `docs/deployment/CLOUDFLARE_ENVIRONMENT_MATRIX.md` for the full current-state
table (worker names, URLs, resource IDs are non-secret and listed there; secret *values* are never
recorded in any repo file).

## Bindings (`apps/web/wrangler.jsonc`)

| Binding    | Type                  | Purpose                                                                                |
| ---------- | --------------------- | --------------------------------------------------------------------------------------- |
| `DB`       | D1 database           | Primary datastore (ADR-0002) — **a distinct database per environment**, see below       |
| `ASSETS`   | Workers Static Assets | Astro's built static output                                                             |
| `SESSION`  | KV namespace          | **Not used by CrawlPact's own code** — see "Astro's own session KV requirement" below   |

## Astro's own session KV requirement (not CrawlPact's session system)

CrawlPact's real session system is D1-backed (ADR-0004, `apps/web/src/lib/auth/session.ts`) — the
app never reads `Astro.session` and has no application-level use for KV. However, `@astrojs/cloudflare`
(the adapter itself, `dist/wrangler.js`'s `DEFAULT_SESSION_KV_BINDING_NAME`) unconditionally enables
its own built-in KV-backed session feature at build time unless `astro.config.mjs`'s top-level
`session.driver` is already set — which it currently isn't. This means the adapter requires a KV
namespace bound as `SESSION` to exist for the build/deploy to succeed, independent of anything the
application code does with it.

This is the origin of two KV namespaces (`crawlpact-web-session`, `crawlpact-web-preview-session`)
that existed in the Cloudflare account before any application deploy had happened — an earlier
build/deploy attempt hit this same undocumented adapter requirement and Cloudflare auto-provisioned
them. Rather than leave them orphaned or create duplicates, `wrangler.jsonc` now declares them
explicitly:

```jsonc
// top-level (production)
"kv_namespaces": [{ "binding": "SESSION", "id": "e092c1f4171243cf801b5af24070dfca" }]
// env.preview
"kv_namespaces": [{ "binding": "SESSION", "id": "6c940efc0991477a88fa9f730c53b476" }]
```

If this adapter-level session requirement is ever removed (e.g. by explicitly configuring a
different/no-op driver in `astro.config.mjs`), these two namespaces can be safely deleted — they
hold no data CrawlPact's own code ever wrote.

## D1 databases

Production (`crawlpact-db`) and preview (`crawlpact-db-preview`) are real, distinct D1 databases —
never point both at the same `database_id`. (Historically, `env.preview` had no `d1_databases`
block at all and silently inherited production's — fixed at Part 3 Step 26; both IDs were still
placeholders until 2026-07-26, when both were created and migrated for the first time.)

To recreate this setup from scratch (e.g. a new Cloudflare account):

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

Both were applied for real on 2026-07-26 — all 16 migrations succeeded on each database (38 tables,
matching `pnpm db:validate`'s schema-drift check).

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

Set per environment with `wrangler secret put <NAME> --config apps/web/dist/server/wrangler.json`
(build first — see `docs/operations/RUNBOOK.md`'s "Deploying" section for why the deploy target is
the generated config, not the source `wrangler.jsonc`):

| Secret                  | Status (2026-07-26)                                                        |
| ------------------------ | -------------------------------------------------------------------------- |
| `SESSION_SIGNING_SECRET` | **Set**, both environments — generated randomly per environment (32 bytes) |
| `PADDLE_API_KEY`         | **Not set** — requires a real Paddle account; billing routes that call the Paddle API will error until this is set |
| `PADDLE_WEBHOOK_SECRET`  | **Not set** — same as above; inbound Paddle webhooks will fail signature verification until set |

Two more Paddle-related values are required by `packages/config/src/env.ts`'s schema but were
never documented anywhere in this file (a real gap, found 2026-07-26) — both also blocked on a
real Paddle account/catalog existing:

- `PADDLE_PRICE_ID_SOLO`, `PADDLE_PRICE_ID_PRO`, `PADDLE_PRICE_ID_AGENCY` — these are **not
  secrets** (Paddle price IDs aren't sensitive) and belong in `wrangler.jsonc`'s `vars`, not
  `wrangler secret put`, once real values exist.
- `PUBLIC_PADDLE_CLIENT_TOKEN` — also not a secret (it's designed to be browser-exposed), belongs
  in `vars` once a real value exists.

Setting up the actual Paddle catalog/product/price records and obtaining these values is a
separate task from Cloudflare configuration — see the `paddle:catalog-setup` skill.

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

**Confirmed live, 2026-07-26.** The `crawlpact.com` zone is active in the same Cloudflare account
as the Worker (nameservers delegated from Namecheap to Cloudflare, zone status `active`), with a
Worker Custom Domain already attached (`crawlpact.com` → `crawlpact-web`, production).

### Domains

- `crawlpact.com` — canonical apex, production. **Live**, serving the real app as of 2026-07-26.
- `www.crawlpact.com` — permanently redirects (301) to the apex. **Confirmed working**, one hop,
  both `http://` and `https://` variants, path and query string preserved.
- `preview.crawlpact.com` — not provisioned. Preview is currently reachable only via its
  `*.workers.dev` subdomain (`crawlpact-web-preview.<account-subdomain>.workers.dev`); the
  `WEBAUTHN_RP_ID`/`WEBAUTHN_RP_ORIGIN`/`PUBLIC_SITE_URL` preview values in `wrangler.jsonc` are
  still placeholders (`preview.crawlpact.com`) and **must** be updated to the real `workers.dev`
  hostname (or a real preview custom domain, if one is added later) before preview passkey
  ceremonies will work — see "Non-secret environment vars" above.

### Confirmed via live HTTP checks (2026-07-26)

- `https://crawlpact.com/` → 200.
- `http://crawlpact.com/` → 301/redirect → `https://crawlpact.com/`, 1 hop.
- `https://www.crawlpact.com/` and `http://www.crawlpact.com/` → both redirect to
  `https://crawlpact.com/`, 1 hop.
- A deep path with a query string (`http://www.crawlpact.com/audit?domain=example.com`) redirects
  to `https://crawlpact.com/audit/?domain=example.com` — query string preserved (the trailing
  slash is Astro's own routing convention, not a redirect defect).
- HTTPS works (Universal SSL active; production and `www.crawlpact.com` both serve valid
  certificates).

### Items that need a dashboard check (not reachable via this session's API token)

The Cloudflare OAuth token obtained via `wrangler login` has full read/write on Workers, D1, and
KV, but the zone-level API (DNS records, SSL/TLS mode, WAF, Page/Redirect/Cache Rules) rejected
every request with an authorization error — Wrangler's default login scope doesn't include these.
The following need a manual dashboard check (Cloudflare dashboard → the `crawlpact.com` zone):

1. **Cloudflare's "Content Signals" / AI Crawl Control is already injecting rules into
   `robots.txt`, unprompted.** Confirmed live: `https://crawlpact.com/robots.txt` currently serves
   a Cloudflare-managed block (`# BEGIN Cloudflare Managed content` ... `# END`) ahead of the
   app's own file, adding `Content-Signal: search=yes,ai-train=no,use=reference` and explicit
   `Disallow: /` rules for GPTBot, ClaudeBot, Google-Extended, CCBot, Bytespider, Amazonbot,
   Applebot-Extended, and meta-externalagent. This is a zone-level default CrawlPact did not
   request in code. Given CrawlPact's entire product is auditing exactly this class of
   crawler-governance signal, whether to keep, adjust, or disable this on CrawlPact's *own* site
   is a product decision, not a technical default to leave unexamined — review under the zone's
   **AI Crawl Control** / **Bots** settings.
2. **SSL/TLS encryption mode** — confirm it's `Full (strict)`, never `Flexible`.
3. **HSTS** — do not enable a long-duration/preload policy until the redirect chain above has been
   re-confirmed post-review of item 1; start with a short `max-age`, no `preload`/
   `includeSubDomains`.
4. **WAF managed rules, custom rules, and rate limiting** — none confirmed configured either way;
   review against the abuse-sensitive routes listed in `docs/security/THREAT_MODEL.md` (auth/
   passkey endpoints, anonymous audit submission, admin actions).
5. **Cache Rules** — confirm no domain-wide "Cache Everything" rule exists; dynamic/authenticated
   routes must never be edge-cached (see `docs/deployment/CDN_CACHE_POLICY.md`).
6. **`workers.dev` exposure** — both `crawlpact-web` and `crawlpact-web-preview` currently have
   `workers.dev` enabled by default (Wrangler's own default when `workers_dev` isn't explicitly
   set in config). Production has a working Custom Domain, so `workers.dev` for production is
   redundant public surface — consider explicitly setting `"workers_dev": false` for production
   once confirmed unneeded. Preview currently *depends* on `workers.dev` (no preview custom domain
   exists) — do not disable it there.
7. **DNSSEC** — not confirmed either way; only enable once registrar-side DS record handling can
   be completed (Namecheap is the registrar of record).

### General requirements (already satisfied, restated for future reference)

1. **Apex is canonical** — confirmed above.
2. **HTTP → HTTPS redirect** — confirmed above.
3. **`www` → apex redirect** — confirmed above, one hop, no loop.
4. **Universal SSL** — active.
5. **DNS records proxied** (orange-cloud) for the apex and `www` — implied by the redirect/HTTPS
   behavior confirmed above (a DNS-only record would bypass Cloudflare, and none of this behavior
   would work).
6. **WebAuthn RP ID and origin** exactly match the real serving domain for production
   (`crawlpact.com`) — confirmed correct in the deployed config. Preview's still needs updating to
   its real `workers.dev` hostname (see "Domains" above).
7. **Preview isolation**: preview has its own D1 database (`crawlpact-db-preview`) and its own
   `SESSION` KV namespace (`crawlpact-web-preview-session`) — confirmed distinct IDs from
   production. `SESSION_SIGNING_SECRET` is set independently per environment (different random
   value each). `PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET` are unset in both environments (see
   "Secrets" above) — once set, use Paddle **sandbox** credentials for preview, never production
   Paddle keys.

### CDN caching

See `docs/deployment/CDN_CACHE_POLICY.md` for the full cache policy (what's safe to cache publicly
vs. never cached) — DNS/CDN configuration and cache-control policy are related but distinct
concerns; this section covers domain/routing/TLS, that document covers response caching.
