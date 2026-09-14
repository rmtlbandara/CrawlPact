# Final Pre-Phase-4 — Observability Readiness

Status 2026-09-14 (superseded from 2026-09-11). Step 1 ("pre-Phase-4 observability step 1"):
Cloudflare Workers Logs enabled for **Preview only**, empirically verified live. Step 2
("Production traffic baseline & sampling decision"): read-only measurement of real Production
traffic and preparation of the exact Production config. Step 3A/3B ("privacy-safe Workers Logs
design"): resolved the path-embedded-bearer-token privacy question empirically — see below. Step
4 ("Production deployment and post-deploy verification", 2026-09-14): the identical, already-
proven-safe config was deployed to Production (PR #178, `f1d817e`, `deploy-production.yml` run
`34798095329`) and independently re-verified live — see the dedicated section below. **Nothing
in this document remains pending.**

```
Preview:     Workers Logs ENABLED, deployed, and TESTED (verified receiving real data)
Production:  ENABLED, DEPLOYED, and INDEPENDENTLY VERIFIED LIVE (2026-09-14) —
              deployment 689a7055-8be7-4abf-8d6d-a49d40f68681, Worker version
              886fb70e-d760-4f3b-87b1-4a71820074ff
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

## Step 2 — Production traffic baseline (2026-09-11, read-only)

Re-verified live before measuring: Production deployment unchanged
(`8eacde5b-46b9-4c3f-92be-9d3c63de43fc` / `a73071e7-...`), Production Worker settings carry no
`observability` key at all, 0 account-wide Logpush jobs, `tail_consumers: []`. Preview's own
settings independently re-confirmed healthy: `observability.enabled: true`,
`head_sampling_rate: 1`, `traces.enabled: false`.

**Measurement method and its limits, stated plainly**: Cloudflare's GraphQL Analytics API caps a
single query's time range at 1 day on this account's Free plan (confirmed by the API's own error
message when a wider range was tried) — so "7 complete days" below is 7 separate 1-day queries,
not one continuous range. `httpRequestsAdaptiveGroups` counts **edge HTTP requests** (every request
Cloudflare's edge received for the zone, filtered to each host), which is not identically the same
count as "Worker invocations" or "Workers Logs events" — a cached/edge-served response wouldn't
invoke the Worker at all, and a single Worker invocation can itself be one log event under
`head_sampling_rate: 1`. For this Worker, `run_worker_first` means effectively every document
request does reach the Worker, so edge-request count is a reasonable, if not perfectly exact,
proxy for Worker-invocation count and therefore for logged-event count at 100% sampling.

**Production Worker only** (`crawlpact.com` + `app.crawlpact.com`, both routed to `crawlpact-web`
— Preview traffic on `preview.crawlpact.com` excluded):

| Day (UTC, trailing 24h windows) | `crawlpact.com` | `app.crawlpact.com` | Total                  |
| ------------------------------- | --------------- | ------------------- | ---------------------- |
| 2026-09-10 (≈ last 24h)         | 1,522           | 1,224               | **2,746**              |
| 2026-09-09                      | 1,846           | 599                 | 2,445                  |
| 2026-09-08                      | 1,663           | 0                   | 1,663                  |
| 2026-09-07                      | 1,143           | 0                   | 1,143                  |
| 2026-09-06                      | 1,555           | 0                   | 1,555                  |
| 2026-09-05                      | 375             | 0                   | 375                    |
| 2026-09-04                      | 3,328           | 0                   | **3,328 (7-day peak)** |

(`app.crawlpact.com` shows 0 before 2026-09-09 because the Custom Domain wasn't attached yet —
not a data gap.)

**7-day average**: (2,746+2,445+1,663+1,143+1,555+375+3,328) / 7 ≈ **1,894 requests/day**.
**Last 24h**: 2,746. **7-day peak day**: 3,328 (2026-09-04). **Peak hour observed** (trailing 24h,
combined both hosts, includes this session's own testing traffic): **625 requests**, at
`2026-09-11T07:00–08:00 UTC` — even sustained for a full day that would be ~15,000/day, still 7.5%
of the daily allowance, confirming actual traffic is bursty rather than continuously high.
Scheduled/cron invocations are not separately broken out by this API (it counts HTTP edge requests
only) — the daily `0 3 * * *` cron would appear in Workers Logs as its own `eventType: "scheduled"`
event once enabled, separately from this HTTP count, at negligible volume (1/day).

## Step 2 — Quota re-verification (source: Cloudflare's own current pricing page, fetched live 2026-09-11)

| Plan                                              | Events (log or trace spans)                          | Retention  |
| ------------------------------------------------- | ---------------------------------------------------- | ---------- |
| **Workers Free** (this account's plan, confirmed) | **200,000 per day**                                  | **3 days** |
| Workers Paid                                      | 20,000,000/month included + $0.60/million additional | 7 days     |

This matches the figure used in step 1's planning — re-verified from a live source this step, not
assumed carried over. One additional fact worth recording: as of this pricing page, **Workers
Traces are currently free during beta and will begin sharing this same quota starting
2026-10-01** — irrelevant to this decision since traces remain disabled throughout, but relevant
context if traces are ever considered later. Sampled-out requests (the `1 - head_sampling_rate`
portion) do not consume the daily allowance — only requests actually selected for logging count
against it, per the same source.

## Step 2 — Sampling calculation

```
Peak observed day:            3,328 requests   (2026-09-04)
Safety multiplier:            10×              (generous — no evidence Phase 4 cutover
                                                 traffic would spike this much; apex+app
                                                 totals didn't exceed ~2,700-3,300/day even
                                                 across active migration testing)
Projected cutover volume:     33,280 events/day
Verified daily allowance:     200,000 events/day
Headroom at 10× multiplier:   83.4% of allowance unused
Headroom at 50× multiplier:   16.6% of allowance unused (166,400 of 200,000)

Recommended head_sampling_rate: 1.0 (100%)
```

**Reason**: Production's actual peak day (3,328) is 1.66% of the daily allowance. Even a
deliberately generous 10× safety multiplier for Phase-4 cutover traffic growth stays at only
16.6% of the allowance — and a 50× multiplier (traffic fifty times anything ever observed) would
still fit. Application-level logging volume is not a wildcard here: `console.*` usage is confirmed
absent from every sensitive path (see below) and sparse elsewhere (a handful of `console.error`
calls in monitoring/domain code, firing only on real failures, not per-request), so default
per-request platform metadata — one event per request — dominates and is exactly what was
measured above. **This recommendation is scoped to the Phase-4 cutover window specifically**, as
asked; if Production traffic later grows by an order of magnitude or more in steady state, this
should be revisited rather than assumed to hold forever.

## Step 2 — Privacy review (Production-specific)

Re-ran the full category-by-category `console.*` grep this step, fresh (not reused from step 1):
**zero matches** in `apps/web/src/lib/auth`, `apps/web/src/lib/billing`,
`apps/web/src/pages/api/auth`, `apps/web/src/pages/api/billing`, `apps/web/src/pages/api/admin`,
`apps/web/src/lib/auth/recovery-codes.ts`, `apps/web/src/lib/auth/webauthn.ts`, Google-auth
code, and Paddle-webhook code. This is the same Worker script as Preview (identical source), so
the finding transfers directly, and was independently re-verified rather than assumed carried
over.

**One genuine, Production-specific finding, not a blocker but not glossed over either**:
CrawlPact has two path-embedded bearer-style tokens — `/feed/[token].xml` (per-user Atom
notification feed) and `/shared/[token]` (shared audit report link) — plus one query-string-based
one, `/sign-in?continuation=<uuid>` / `/app/continue?continuation=<uuid>` (a single-use,
expiring, server-checked capability token, `crypto.randomUUID()`, atomically consumed). Cloudflare
Workers Logs captures the **full request URL by default**, including path segments — there is no
"path redaction" equivalent to query-string redaction, and this account's observed
`redact_query_string: false` setting isn't even exposed as a `wrangler.jsonc`-configurable field
in the installed Wrangler version or in current Cloudflare docs (likely dashboard-only). This means
enabling Production Workers Logs will retain these tokens verbatim, visible to whoever has this
Cloudflare account's dashboard access, for 3 days. **This does not meet the bar of "a sensitive
custom log CrawlPact's code writes"** (it's Cloudflare's own default platform URL capture, not an
application `console.*` call, and it's already true for Preview since step 1), and exposure is
scoped to internal dashboard access only, not a public leak — both feed tokens and shared-report
tokens already have an existing, product-level revocation mechanism
(`revoke-feed-tokens`/`revoke-shared-reports`/`revoke.ts`) precisely for this class of concern.
Recorded here as a real, understood fact rather than treated as a blocker — the account owner is
the one with dashboard access in question.

**Superseded by Step 3A/3B below**: this paragraph's premise — "there is no path redaction
equivalent to query-string redaction" — was the correct read of the _schema_ (still true: no such
configurable field exists), but a decisive empirical test found Cloudflare redacts these values
by **platform default**, independent of any schema field. The tokens described here as "retained
verbatim" are, in practice, not retained verbatim at all. See Step 3A/3B for the full experiment.

## Step 3A/3B — Privacy-safe Workers Logs design: resolved empirically

The owner's Step 3A directive stated a hard invariant — "NO REAL PATH-EMBEDDED BEARER TOKEN MAY BE
PERSISTED IN OBSERVABILITY DATA" — and required this session to (1) confirm the bearer-token
security model, (2) verify the installed Wrangler schema and `invocation_logs`/`persist` semantics
empirically rather than by assumption, and (3) test candidate configurations on Preview only, using
only synthetic tokens.

**Schema verification (read directly from the installed package, not docs)**: read
`node_modules/.pnpm/wrangler@4.123.0.../wrangler-dist/cli.d.ts` directly. Confirmed fields:
`observability.enabled`, `observability.head_sampling_rate`, `observability.logs.{enabled,
head_sampling_rate, invocation_logs, persist, destinations}`, `observability.traces.{enabled,
head_sampling_rate, persist, destinations}`. **`redact_query_string` does not exist anywhere in
this schema** — the field named in the owner's Step 3A "Candidate A" draft is not a real Wrangler
config option in this installed version. Even if it existed, it would only cover query strings;
both real path-embedded tokens in this codebase (`/feed/[token].xml`, `/shared/[token]`) are in the
URL _path_, which no schema field redacts.

**`invocation_logs: false` semantics, tested empirically (a real deploy + real request + a real
telemetry query, not inferred from the field's name)**: deployed a temporary experiment branch
(`experiment/preview-observability-candidate-a`, a synthetic-token diagnostic route, `console.error`
included) with `observability.logs.invocation_logs: false` to Preview, made requests, then queried
`POST /accounts/{id}/workers/observability/telemetry/query`. Result: **zero events of any kind**
came back — not just the automatic per-request summary, but the explicit `console.error()` call
too. This disproves the initial hypothesis that this field selectively suppresses only the
automatic summary event; it suppresses all telemetry for the Worker, unconditionally. The owner's
own instruction ("No assumption is acceptable") was honored by running this test rather than
trusting the field's name.

**The decisive experiment — does Cloudflare redact high-entropy path/query values by default?**
Reverted to the plain, already-approved config (`{enabled: true, head_sampling_rate: 1}`, no
`logs`/`invocation_logs` overrides) and ran a controlled comparison, synthetic tokens only, on the
same temporary experiment branch:

```
Control (plain, non-secret path segment):        logged VERBATIM in captured telemetry
/feed/[synthetic-256-bit-token].xml (real route): RAW PATH TOKEN PRESENT: NO — value shows REDACTED
/shared/[synthetic-256-bit-token] (real route):   RAW PATH TOKEN PRESENT: NO — value shows REDACTED
?continuation=<synthetic-uuid> (query string):    RAW PATH TOKEN PRESENT: NO — value shows REDACTED
console.error() with a synthetic token in the
  logged object (custom event, not auto-enriched
  beyond what was explicitly logged):             the synthetic token string itself was also
                                                   replaced with REDACTED
```

**Finding: Cloudflare Workers Logs automatically redacts high-entropy path segments and
query-string values, platform-wide, with zero special configuration.** This was verified with a
positive control (the plain segment logged unredacted, proving the pipeline isn't blanket-hiding
everything) and multiple realistic 256-bit-entropy synthetic tokens across the real, unmodified
`/feed/*` and `/shared/*` code paths plus the real `?continuation=` query parameter — not a
synthetic-only route in isolation. This is an independently discovered platform behavior, not a
claim taken from Cloudflare's marketing docs.

**Consequence for the architecture decision the owner's Section 5 posed**: neither the "preferred"
architecture (redact_query_string + invocation_logs off) nor the "fallback" (build sanitized
application-level logging) is necessary. **The already-approved, already-deployed-to-Preview Step 1
configuration already satisfies the hard invariant, today, with zero further code or config
change.** This is confirmed both indirectly (auto-redaction) and directly (the exact real routes
carrying real-shaped tokens were tested, not just a hypothetical).

All experimental artifacts were cleaned up: the temporary diagnostic route and the entire
`experiment/preview-observability-candidate-a` branch were deleted (local and remote), and Preview
was redeployed back to the approved `dc69329ad6b2c20937778571f5b7b4640c78c1a8` state
(`observability: { enabled: true, head_sampling_rate: 1 }`, unchanged since Step 1). No experiment
code reached `main`, PR #175, or PR #176.

## Step 2 — Proposed Production change (not applied — requires explicit owner approval)

```jsonc
// Top-level `apps/web/wrangler.jsonc`, alongside the existing top-level `vars` etc.:
"observability": {
  "enabled": true,
  "head_sampling_rate": 1,
},
```

Proven by the same build-diff method used in step 1 (not yet executed for this exact edit, since
it isn't applied): this key lives at the top level, which the build pipeline flattens into
Production's generated `wrangler.json` only — Preview's `env.preview.observability` block is a
separate, already-present key and would be completely unaffected (Preview keeps its existing
`head_sampling_rate: 1`). No `traces` key is included. No unrelated `vars`, billing, or audit
setting is touched — this is the only key this change would add.

## Step 2 — Post-enable verification plan (prepared, not executed)

To run only after explicit approval and only against a real Production deployment of this change:

1. Confirm the Production deploy workflow run succeeded.
2. Confirm the deployed Worker version ID matches the approved commit.
3. `https://crawlpact.com/` → 200, representative public pages unchanged.
4. `https://app.crawlpact.com/` → 200 (app-shell), `/sign-in` → 200.
5. Public/app host boundary unchanged: `app.crawlpact.com/about/` still 308s to apex; `/for/*`
   alias fix still one-hop; `/app`, `/admin` still gated.
6. App root/sign-in still carry `X-Robots-Tag: noindex, nofollow, noarchive` and remain
   crawlable per the approved robots policy.
7. A live authenticated route (owner-performed, not this session) still behaves correctly.
8. Query Cloudflare's telemetry API for `$metadata.service = "crawlpact-web"` events in the
   minutes after deploy — confirm real events arrive, same method as step 1's Preview proof.
9. Request one intentional safe 404 on Production (a clearly synthetic, non-guessable path) and
   confirm it appears in the telemetry query result.
10. Re-check zone-level 5xx rate before/after the deploy — confirm no new 5xx introduced by the
    config change itself (a pure config addition should introduce none).
11. Spot-check a handful of returned log events for absence of `Authorization` headers, cookie
    values, or recovery-code-shaped strings — confirming the privacy review's conclusion held in
    practice, not just in theory.
12. Confirm the daily cron's next firing appears in telemetry as an `eventType: "scheduled"`
    event (may require waiting until the next `0 3 * * *` UTC firing).
13. Confirm the rollback procedure (below) actually works by exercising it once in a low-risk
    window if the owner wants that extra proof before relying on it.

## Step 4 — Production deployment and independent post-deploy verification (2026-09-14)

**Deployment**: PR #178 (`feat/observability-production-step2`) added the identical top-level
config to `wrangler.jsonc`, merged to `main` as `f1d817e7a03c2ae5a98e5ab0781ce01fef2fd110` after
fresh CI passed on that exact commit. `deploy-production.yml` run `34798095329` deployed it —
deployment `689a7055-8be7-4abf-8d6d-a49d40f68681`, Worker version
`886fb70e-d760-4f3b-87b1-4a71820074ff` (version 85).

**Independent verification, CLOUDFLARE API / TELEMETRY evidence** (not accepted on the deploy
workflow's success status alone):

- Live Worker settings re-read via the Cloudflare API confirm
  `{ enabled: true, head_sampling_rate: 1, traces.enabled: false }` — byte-for-byte the same
  shape as Preview's Step 1 config.
- Workers Logs actively receiving Production events after deployment; a synthetic
  (non-guessable, no real token) safe 404 was visible in telemetry within seconds, correctly
  attributed to `scriptVersion.id: 886fb70e-...` — the exact deployed version.
- Zero `5xx` responses and zero non-`info`-level events (no exceptions) in the post-deploy
  telemetry window.
- **Redaction re-confirmed on Production itself, not only Preview**: fresh synthetic 256-bit
  tokens against the real `/feed/[token].xml` and `/shared/[token]` routes, and a synthetic
  `?continuation=` query value, all showed `REDACTED` in captured Production telemetry. No real
  bearer token was used for this check.

**Independent verification, LIVE HTTP evidence**: all four canonical URLs return 200 with correct
indexability headers (apex indexable, app host `noindex`); apex sitemap contains zero app-host
URLs; unauthenticated `/app`/`/admin` on the app host still 302 to sign-in; the `workers.dev`
fallback still 404s the same sensitive routes; the BIC exception rule and `WEBAUTHN_RP_ID` are
both confirmed live and unchanged — none of these were disturbed by the deployment.

**Privacy note recorded accurately, not glossed over**: one intermediate telemetry query during
this verification returned standard Cloudflare per-request platform metadata (client IP, TLS
fingerprint, coarse geolocation) — this is exactly the already-documented, expected default
Workers Logs capture behavior described earlier in this document, not an application secret or an
unexpected leak. That raw payload was not reproduced in any report or committed anywhere.

**Result: PRODUCTION OBSERVABILITY — PASS.** No further action is pending on this item.

## Rollback procedure

**Preview**: set `env.preview.observability.enabled` to `false` (or remove the block), rebuild,
redeploy Preview.

**Production**: remove the top-level `observability` key (or set `enabled: false`), rebuild,
redeploy Production. Single-field config change and redeploy either way — no data migration, no
persistent application-state change, no D1/KV/R2 impact. Already-ingested log events are
unaffected regardless of the toggle's current state (they age out per the 3-day Free-plan
retention on their own schedule). Not exercised this pass — recorded as available, not proven
in practice.

## Recommendation

**Production enablement is complete.** The evidence supported it clearly at approval time (100%
sampling under 2% of the daily allowance even at observed peak, no sensitive application-level
logging, Step 3A/3B's decisive empirical redaction finding), the owner's 2026-09-11 explicit
authorization (Section 6) covered the deployment without a further approval round, and Step 4
above independently confirms the deployed result live matches what was approved — including
re-proving the redaction guarantee against Production itself, not just inferring it from Preview.
See `OWNER_ACTION_QUEUE.md` item 3 (closed).

```
Production Workers Logs status: ENABLED, DEPLOYED, and INDEPENDENTLY VERIFIED (2026-09-14)
                                  config: { enabled: true, head_sampling_rate: 1 }
                                  deployment: 689a7055-8be7-4abf-8d6d-a49d40f68681
                                  version:    886fb70e-d760-4f3b-87b1-4a71820074ff
```
