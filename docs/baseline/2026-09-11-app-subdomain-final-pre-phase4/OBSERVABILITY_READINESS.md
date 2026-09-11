# Final Pre-Phase-4 — Observability Readiness

Status 2026-09-11. Updated same day, "pre-Phase-4 observability step 1": Cloudflare Workers Logs
enabled for **Preview only**, empirically verified live. **Production is unchanged and NOT YET
ENABLED** — this requires the owner's separate, explicit approval before proceeding.

```
Preview:     Workers Logs ENABLED, deployed, and TESTED (verified receiving real data)
Production:  Workers Logs NOT YET ENABLED — owner approval required before change
```

## What changed this step

`apps/web/wrangler.jsonc`'s `env.preview` block now declares:

```jsonc
"observability": {
  "enabled": true,
  "head_sampling_rate": 1,
},
```

The top-level (Production) config declares no `observability` key at all — unchanged from before
this step. Verified empirically, not assumed from documentation: `observability` is marked
`@inheritable` in the installed Wrangler 4.123.0's own bundled config schema, but this repo's
build pipeline never uses `--env` at deploy time (`build.sh` bakes the target in via
`CLOUDFLARE_ENV`, producing one flattened `wrangler.json` per target). Built both targets before
and after this edit and diffed the generated `apps/web/dist/server/wrangler.json`: Production's
output was byte-identical to before; Preview's carried exactly the value above and no `traces`
key. A new test (`apps/web/src/wrangler-observability.test.ts`) guards the source config against
future silent drift.

Deployed to Preview via `deploy-preview.yml` (`workflow_dispatch`, exact commit SHA
`dc69329ad6b2c20937778571f5b7b4640c78c1a8`) — deployment `199ae78c-4c2c-4998-885a-6ba94b094d37`,
version `47a07100-0873-46ff-a7be-cb5cc1dfb8f1`, `2026-09-11T08:14:09Z`. The workflow's own
build/migrate/seed/deploy/binding-verification/smoke-test/Lighthouse-budget steps all passed.

## Empirical post-deploy verification

- `https://preview.crawlpact.com/` → 200; `/sign-in` → 200; `/about/` → 200 (public content still
  served, single-origin preview unaffected).
- `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` still present on `/` — search isolation
  intact.
- `/robots.txt` still `User-agent: * / Disallow: /` — unchanged.
- An intentional safe 404 (`GET /observability-step1-test-marker-2026-09-11`) was requested and
  confirmed 404.
- **Workers Logs are genuinely receiving data** — queried directly via
  `POST /accounts/.../workers/observability/telemetry/query` (`view: "events"`, filtered to
  `$metadata.service = "crawlpact-web-preview"`, last 15 minutes) and got back real event rows for
  every request above, including the intentional 404 (`response.status: 404`, `outcome: "ok"`),
  all correctly attributed to `scriptVersion.id: "47a07100-..."` — the exact version just deployed.
  This is not a documentation claim; it's a live query result.
- Cron/scheduled-invocation visibility: not directly observed this step (the daily `0 3 * * *`
  cron hadn't fired again since deployment at the time of this check), but Workers Logs captures
  every invocation type uniformly by `eventType` (`fetch` confirmed above; `scheduled` would appear
  the same way on the next cron fire) — understood from the platform's own event schema, not
  assumed without basis.

## Privacy/logging review

Two genuinely different things, kept distinct:

1. **CrawlPact's own application logging** (`console.error` calls in the Worker code) — grepped
   the entire `apps/web/src` tree: every call logs only opaque IDs (`domainId`, `scanId`) and
   `error` objects, all inside domain/monitoring/timeline diagnostic code paths. **Zero
   `console.*` calls exist anywhere in the auth or billing code paths** (`apps/web/src/lib/auth`,
   `apps/web/src/lib/billing`, `apps/web/src/pages/api/auth`, `apps/web/src/pages/api/billing` —
   confirmed by direct grep, no matches). No secrets, session values, recovery codes,
   Authorization headers, or request bodies are written by CrawlPact's own logging anywhere.
2. **Cloudflare's own default Workers Logs request metadata** — enabling Workers Logs at all
   causes Cloudflare's platform to automatically capture per-request metadata regardless of
   anything CrawlPact's code does: client IP (`cf-connecting-ip`), coarse geolocation (city/region/
   postal code/lat-long), TLS fingerprint data, and request headers (excluding `Authorization` and
   cookie values, which Cloudflare does not include in this capture). **This is new data retention
   that did not exist before this step** — client IPs and geolocation for Preview visitors are now
   retained for 3 days (the Free-plan default) where previously nothing was retained at all. This
   is standard Workers Logs behavior across every Cloudflare Worker, not something CrawlPact opted
   into beyond enabling the feature itself, and Preview traffic is low-volume, internal-testing-only
   traffic — but it is a real, honest fact about this change, not glossed over.

## Sampling-rate decision — evidence, not just judgment

Queried Cloudflare's GraphQL Analytics API for actual `preview.crawlpact.com` request volume over
the trailing 24 hours (this session's own testing plus CI/Lighthouse traffic included, so an
elevated, not typical, baseline): **1,248 requests**. At 100% head sampling, that's ~1,248 log
events/day — **0.6% of the Workers Free plan's 200,000 events/day allowance**. Even with
significant headroom for growth, real production-comparable traffic, or a busier Phase-4 cutover
window, 100% sampling stays safely within the free allowance for Preview specifically. **100%
sampling is appropriate for Preview and is what's currently configured.** This conclusion does not
automatically transfer to Production without checking Production's own real traffic volume first
— Production serves genuine public/customer traffic and could plausibly be much higher-volume;
that check is part of the Production-enablement proposal below, not assumed here.

## Proposed Production change (not applied — requires explicit owner approval)

```jsonc
// Top-level `wrangler.jsonc`, alongside the existing top-level config:
"observability": {
  "enabled": true,
  "head_sampling_rate": <TBD — check Production's real 24h request volume against the
                          200,000 events/day Free-plan allowance before fixing this number;
                          do not assume 1 (100%) is safe for Production without that check>,
},
```

Before proposing an exact Production sampling rate, this session would need to query Production's
own real request volume the same way Preview's was checked above (`clientRequestHTTPHost:
"crawlpact.com"` and `"app.crawlpact.com"` in the same GraphQL query) — not done in this step by
design, since Production enablement itself is out of scope until approved.

## Rollback procedure

Set `env.preview.observability.enabled` to `false` (or remove the block entirely) in
`wrangler.jsonc`, rebuild, and redeploy Preview — a single-field config change and redeploy, no
data migration, no irreversible state. Already-ingested log events are unaffected either way (they
simply age out per the 3-day Free-plan retention regardless of the toggle's current state).

## Recommendation

**Production enablement is recommended in principle** (Phase 4 should not begin with zero
cutover-monitoring signal — this remains true), but **not yet, and not without**: (a) checking
Production's real traffic volume against the Free-plan allowance to pick a safe, evidence-based
sampling rate (almost certainly not 100% — Production carries real customer traffic, unlike
Preview), and (b) the owner's explicit approval, since this is a real Production configuration
change with genuine (if standard-for-the-platform) new data-retention implications. See
`OWNER_ACTION_QUEUE.md` item 3.
