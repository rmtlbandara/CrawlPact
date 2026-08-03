# Cloudflare Configuration

**Status as of 2026-07-26: a real Cloudflare account and zone are connected, and both environments
are deployed.** See `docs/deployment/CLOUDFLARE_ENVIRONMENT_MATRIX.md` for the full current-state
table (worker names, URLs, resource IDs are non-secret and listed there; secret _values_ are never
recorded in any repo file).

## Bindings (`apps/web/wrangler.jsonc`)

| Binding   | Type                  | Purpose                                                                               |
| --------- | --------------------- | ------------------------------------------------------------------------------------- |
| `DB`      | D1 database           | Primary datastore (ADR-0002) — **a distinct database per environment**, see below     |
| `ASSETS`  | Workers Static Assets | Astro's built static output                                                           |
| `SESSION` | KV namespace          | **Not used by CrawlPact's own code** — see "Astro's own session KV requirement" below |

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
matching `pnpm db:validate`'s schema-drift check at the time). More migrations have been applied
since 2026-07-26; see `docs/status/CURRENT_STATE.md` for the current migration/table count rather
than treating this dated record as still current.

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

| Secret                   | Status (2026-07-26)                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SESSION_SIGNING_SECRET` | **Set**, both environments — generated randomly per environment (32 bytes)                                                                                                                                                                                                                                                          |
| `PADDLE_API_KEY`         | **Set**, production, 2026-07-26 — live Paddle account API key. Not yet set for preview (should be a sandbox key when set)                                                                                                                                                                                                           |
| `PADDLE_WEBHOOK_SECRET`  | **Set**, production, 2026-07-26 — signing secret from the live webhook destination `ntfset_01kyfkc59d8h66prnhw220hnzy` (destination `https://crawlpact.com/api/billing/webhook`, subscribed to `subscription.*`/`transaction.*`/`adjustment.*`/`customer.*`, matching what `webhook-processor.ts` handles). Not yet set for preview |

Two more Paddle-related values are required by `packages/config/src/env.ts`'s schema:

- `PADDLE_PRICE_ID_SOLO`, `PADDLE_PRICE_ID_PRO`, `PADDLE_PRICE_ID_AGENCY` — **not secrets**
  (Paddle price IDs aren't sensitive), so they live in `wrangler.jsonc`'s production `vars`, not
  `wrangler secret put`. **Set** as of 2026-07-26 — real live-catalog products/prices created via
  the `paddle:catalog-setup` skill (Solo $79/yr, Pro $179/yr, Agency $399/yr, all `saas` tax
  category).
- `PUBLIC_PADDLE_CLIENT_TOKEN` — also not a secret (it's designed to be browser-exposed), belongs
  in `vars`. **Set** as of 2026-07-26 — live client-side token `ctkn_01kyfk8x7xbsz450tet3zb4c96`
  created via the Paddle MCP.

**Correction (verified 2026-07-26 via a direct, read-only Cloudflare API call against the live
`crawlpact-web` Worker's settings)**: the paragraph above claiming these two secrets remain unset
was stale — `PADDLE_API_KEY` and `PADDLE_WEBHOOK_SECRET` are both genuinely bound as `secret_text`
on the live Worker right now, confirming the table above rather than contradicting it.

**Real, currently-live gap found during that same check**: `PADDLE_PRICE_ID_SOLO`,
`PADDLE_PRICE_ID_PRO`, `PADDLE_PRICE_ID_AGENCY`, and `PUBLIC_PADDLE_CLIENT_TOKEN` — all `vars` in
`wrangler.jsonc` — are **absent from the live Worker's actual deployed bindings**, even though the
secrets above are present and the file on disk has correct values. Root cause, confirmed from the
account's own deployment history: the last full `wrangler deploy` ran at `2026-07-26T12:28:44Z`,
but the Paddle catalog and these four `vars` were only added to `wrangler.jsonc` afterward (Paddle
resources created ~16:08–16:14Z the same day). The two later deployments (16:17–16:18Z) were both
`wrangler secret put` calls (`"triggered_by": "secret"` in the deployment history) — those only
attach the named secret to the already-running version; they don't re-read `wrangler.jsonc`'s
`vars` block. **Practical effect: checkout is very likely broken in production right now** —
`/api/billing/checkout` reads `env.PADDLE_PRICE_ID_SOLO` etc. directly with no request-time
validation (`apps/web/src/lib/billing/plan-mapping.ts`), so a missing var resolves to `undefined`
rather than an error, silently handing an invalid price ID to Paddle.js instead of failing loudly.
**Resolved 2026-07-26, same pass**: the user explicitly authorized a production deploy; rebuilt and
ran `wrangler deploy` against the current `wrangler.jsonc` (Version ID
`69b71641-7dc6-4411-9c7e-ea539eb31967`). A direct Cloudflare API read of the live Worker's settings
afterward confirmed all four vars now present with correct values, and
`https://crawlpact.com/`/`/status` both returned `200`.

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

**Adopted 2026-07-30, narrowly.** One bucket, `AGENCY_LOGOS` binding → `crawlpact` (production) /
`crawlpact-preview` (preview), holding only agency-branding logo uploads (SRS §29). See
`docs/data/D1_R2_DATA_PLACEMENT_POLICY.md`'s 2026-07-30 entry for the decision (revisit trigger #1
fired: a real file-upload feature replaced the old URL-only branding field) and
`apps/web/wrangler.jsonc` for the binding. Nothing else uses R2 — the rest of
`D1_R2_DATA_PLACEMENT_POLICY.md`'s "Keep in D1" analysis is unchanged.

## DNS, SSL, and domain configuration (Phase 14)

**Confirmed live, 2026-07-26.** The `crawlpact.com` zone is active in the same Cloudflare account
as the Worker (nameservers delegated from Namecheap to Cloudflare, zone status `active`), with a
Worker Custom Domain already attached (`crawlpact.com` → `crawlpact-web`, production).

### Domains

- `crawlpact.com` — canonical apex, production. **Live**, serving the real app as of 2026-07-26.
- `www.crawlpact.com` — permanently redirects (301) to the apex. **Confirmed working**, one hop,
  both `http://` and `https://` variants, path and query string preserved.
- `e2e-fixture.crawlpact.com` — a separate, minimal, static Cloudflare Worker
  (`apps/e2e-fixture/`), **not** the main `crawlpact-web` app. Test infrastructure only: a real,
  CrawlPact-controlled scan target for two required e2e tests (`auth-and-account.spec.ts`) that
  need a genuine, publicly-resolvable HTTP origin — see `docs/status/KNOWN_RISKS.md`'s "SSRF-safe
  deterministic scanner test target" entry. Never referenced by production app code.
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
   crawler-governance signal, whether to keep, adjust, or disable this on CrawlPact's _own_ site
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
   once confirmed unneeded. Preview currently _depends_ on `workers.dev` (no preview custom domain
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
