---
Document owner: Engineering owner
Status: current-authoritative (Phase 1, Workstream 3 — Real User Monitoring)
---

# CrUX and RUM — 2026-09-17

## CrUX

Unchanged from the existing diagnostic: `queryCrux` (`lib/google/crux.ts`) correctly maps a missing
field-data response to `{ status: "no_data" }`. This is a legitimate, expected state — this origin
has not yet reached Chrome UX Report's minimum-traffic eligibility threshold — not a defect. No
change needed; `crux_snapshots` (migration `0039`) is ready to receive real rows the moment the
origin becomes eligible, with no code change required then.

## Real User Monitoring — implemented this pass

Since CrUX cannot supply field data yet, this pass implements first-party RUM as the interim field-
performance source (directive §10/§17), rather than waiting on traffic growth.

**Data model** — migration `0040_rum_vitals.sql`: one row per metric per beacon
(`metric_name`, `metric_value`, `rating`, `route`, `surface`, `device_category`, `recorded_at`).
No user id, session id, IP address, query string, or raw pathname is ever stored — `route` is
always a bounded template bucket (e.g. `/crawlers/:slug/`, `/app/:section/`, `other`), computed by
`lib/rum.ts`'s `normalizeRumRoute`, never the literal path a visitor requested.

**Collection** — `apps/web/src/components/WebVitalsRUM.astro`, included from `BaseLayout.astro`
(covers every layout: Marketing, App, Admin, Auth) and gated to `PUBLIC_APP_ENV === "production"`
at the call site — mirroring `GoogleAnalytics.astro`'s own documented reason for that exact
pattern (Astro's compiler can't process a `<script>` body containing `{}` when the tag itself sits
inside a `{condition && (...)}` expression, so the gating happens at the caller, not inside the
component). Uses Google's own `web-vitals` package (pinned `4.2.4`, ~2KB) rather than a hand-rolled
`PerformanceObserver` — correctly computing INP is genuinely intricate, and this is the library the
Core Web Vitals documentation itself points to. Each metric (LCP/INP/CLS/FCP/TTFB) is sent via
`navigator.sendBeacon` (falling back to a `keepalive` `fetch`) the moment `web-vitals` reports it,
matching the library's own recommended pattern rather than buffering until page unload.

**Not gated behind analytics consent.** Unlike `GoogleAnalytics.astro`/`MicrosoftClarity.astro`,
this loads no third-party script, sets no cookie, and sends no identifier — it is first-party
functional telemetry, the same category as the existing `/api/analytics/track` endpoint, not
third-party behavioural analytics. Documented explicitly in the component's own doc comment so this
reasoning is auditable, not silently assumed.

**Ingestion** — `POST /api/rum` (`apps/web/src/pages/api/rum.ts`), registered as
`SHARED_SAME_ORIGIN_SURFACE` in `route-ownership.ts` (same classification as
`/api/analytics/track` — reachable from both the public and app hosts). Server-side, not
client-trusted:

- Surface (`public`/`app`) is derived from the request's Host header via the existing
  `classifyRequestOrigin`, never taken from the client body.
- Every metric value is validated against a generous but bounded sanity range
  (`isValidMetricValue`) — a metric outside it is silently dropped, not stored, without failing the
  rest of a legitimate batch.
- Rate-limited via the same `security_events`-backed sliding-window mechanism already used by
  `/api/domains/export.csv.ts` and others (60 requests / 5 minutes per IP-hash) — deliberately kept
  separate from `rum_vitals` itself, which never stores an IP hash at all, so the abuse-prevention
  signal and the actual telemetry data have different, appropriately-scoped privacy properties.
- The route value is normalized server-side too (never trusts a client-labelled route), bounding
  cardinality and guaranteeing no pasted token/PII fragment in a URL can reach storage.

## Test evidence

- `apps/web/src/lib/rum.test.ts` (10 tests): route normalization (exact matches, dynamic-slug
  bucketing, query-string/fragment stripping, unrecognized-path fallback to `"other"`), metric-value
  bounds checking, and `recordRumMetrics`'s partial-batch tolerance (an invalid metric is dropped,
  not fatal) and no-op-when-nothing-valid behavior.
- `apps/web/tests/integration/rum-endpoint.integration.test.ts` (3 tests, real D1): a valid beacon
  persists with the route bucketed (not the raw path); a malformed payload is rejected (400) and
  writes nothing; repeated beacons from the same caller are rate-limited.
- `apps/web/src/lib/route-ownership.test.ts`: extended to cover `/api/rum`'s
  `SHARED_SAME_ORIGIN_SURFACE` classification; the existing "every real API route file classifies,
  never UNKNOWN" invariant test (dynamic directory scan) passes with the new route file present.
- Full repo: `pnpm typecheck` (astro check, 0 errors — including the RUM script itself, once
  correctly un-inlined so Astro actually type-checks and bundles it), `pnpm lint` (0
  warnings/errors), `pnpm format:check` (clean), `pnpm build` (succeeds; the bundled RUM script was
  inspected directly in `dist/client/_astro/` to confirm the `web-vitals` import was actually
  resolved into the bundle, not left as a broken bare specifier — see the note below).

## A real mistake caught before it shipped

The first version of `WebVitalsRUM.astro` used `<script type="module">` with an inline
`import ... from "web-vitals"` statement. The build succeeded and `astro check` was clean, which
looked correct — but Astro's own IDE diagnostics flagged that a `<script>` tag carrying _any_
attribute (including `type="module"`) is automatically treated as `is:inline`, meaning Astro never
processes or bundles it — the npm import would have shipped to real browsers as a literal, broken
`import ... from "web-vitals"` statement (a bare specifier with no import map), failing silently at
runtime. Fixed by dropping the attribute (a bare `<script>` tag is what Astro actually bundles) and
verified by grepping the built output for the resolved `web-vitals` code with zero remaining
`import` statements. Recorded here because "the build passed" was not sufficient evidence on its
own for a claim this specific — worth remembering for any future inline-script-with-npm-import
work in this codebase.

## Remaining

No p75 figures exist yet — this is a genuinely new collection mechanism with zero real production
traffic behind it so far (nothing here has been deployed). Per directive §36, this is not a Phase 1
blocker: "if there has not yet been enough time to establish meaningful p75 values, collection must
still be live and validated" — which it is, locally. Real p75s can only be reported honestly after
a Production deployment and some real traffic; fabricating them now would violate the project's own
"never present mocked data as a real product outcome" rule.

## Addendum (2026-09-19, found during Phase 2) — `rum_vitals` contains lab traffic

**Finding.** `rum_vitals` is not purely real-visitor data. Headless Chrome driven by Lighthouse
executes the page's `web-vitals` script exactly as a real browser does, and the RUM beacon is
gated only on `PUBLIC_APP_ENV === "production"`, not on who is browsing. Any Lighthouse run
against `https://crawlpact.com` therefore writes synthetic rows.

**Evidence (live D1 read, 2026-09-19):**

- Rows per UTC day: 2026-09-17 → 157, 2026-09-18 → 4, 2026-09-19 → 38 (all `surface = public`).
  The 157 on Sep 17 coincide with Phase 1's Production Lighthouse runs and deploy smoke tests, not
  with organic traffic (site traffic that week is on the order of one session per day).
- 24 of today's 38 rows are `route = /guides/`, `device_category = mobile`, all inside one
  61-second window (10:29:18–10:30:19 UTC). That is the Production Lighthouse baseline run made
  during Phase 2 (Lighthouse emulates mobile by default) — **a side effect of this phase's own
  verification work**, disclosed here rather than left for someone to trip over.
- Lighthouse 13.4.1's emulated user agents (read from its `core/config/constants.js`) are ordinary
  Chrome-on-Android / Chrome-on-macOS strings with no `Lighthouse` marker, so a User-Agent filter
  would **not** work. (An earlier assumption that they end in `Chrome-Lighthouse` was checked and
  found wrong before any code was written against it.)

**Consequence.** The `/admin/growth` RUM section and any p75 derived from `rum_vitals` currently
blend lab and visitor samples and must not be cited as a real-visitor Core Web Vitals baseline.
Phase 1's completion report correctly said real-visitor RUM was not yet available; nothing in it
claimed a p75.

**Not done, deliberately:** no rows were deleted (irreversible production write, not requested; a
concurrent real visitor cannot be ruled out with certainty) and no filter was implemented (needs a
design decision). Options for the owner, none implemented:

1. Skip the beacon when the URL carries a lab marker (e.g. `?lab=1`) that
   `scripts/lighthouse-check.mjs` appends — simple, but it changes the script the deploy pipelines
   run, and only covers runs that opt in.
2. Skip the beacon when `navigator.webdriver` is true — cheap, but whether Lighthouse's launch
   flags set it was not verified.
3. Accept lab rows and instead exclude known lab windows/bursts when reading — no code change,
   but fragile.

Cleanup of the confirmed burst, if the owner wants it (review first — it is irreversible):

```sql
DELETE FROM rum_vitals
WHERE route = '/guides/' AND device_category = 'mobile'
  AND recorded_at BETWEEN '2026-09-19T10:29:00Z' AND '2026-09-19T10:31:00Z';
-- expected: changes = 24
```

Until one of these is done, avoid further Lighthouse runs against Production outside the deploy
pipeline; Preview runs are unaffected (the beacon is not loaded there).
