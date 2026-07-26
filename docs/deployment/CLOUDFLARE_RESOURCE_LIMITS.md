# Cloudflare Resource Limits — Verified Baseline

**Status:** Phase 0 ("Mandatory Current-Limit Verification") of the Cloudflare
infrastructure-alignment brief. This document is a **fact-finding record only** — it does not
change any application code, `wrangler.jsonc`, or architecture. It exists so that later phases of
the brief (capacity planning, alerting thresholds, upgrade triggers) are built on numbers actually
read from current official Cloudflare documentation on the date below, not on remembered or
assumed figures.

**Date verified:** 2026-07-26
**Verified by:** Claude Code, against live fetches of `developers.cloudflare.com` pages on the
date above (not training-data memory). Every row below cites the exact URL fetched.
**Plan assumed:** Workers Free (CrawlPact does not currently hold a paid Cloudflare plan). Paid
figures are noted parenthetically only where they clarify what upgrading buys.
**Scope:** CrawlPact today is a single Worker (Astro on Workers, `apps/web/wrangler.jsonc`) with
one D1 binding (`DB`) and Workers Static Assets (`ASSETS`). No R2 binding exists yet in the repo —
the R2 section below is forward-looking, for when/if R2 is adopted.

> Honesty note: every number below was extracted from a live fetch of the cited URL. Where a
> fetch could not confirm a figure precisely (e.g. the exact error-code page for 1027 returned
> 404), that is stated explicitly in the row rather than silently filled in from memory.

---

## Summary table (all ~27 limits at a glance)

| #   | Service | Metric                               | Free-plan value                                                                                                       |
| --- | ------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| 1   | Workers | Daily request limit                  | 100,000 requests/day, resets 00:00 UTC                                                                                |
| 2   | Workers | CPU time per invocation              | 10 ms (HTTP request and Cron Trigger invocation alike)                                                                |
| 3   | Workers | Memory limit                         | 128 MB per isolate                                                                                                    |
| 4   | Workers | External subrequests per request     | 50                                                                                                                    |
| 5   | Workers | Internal service-binding subrequests | 1,000                                                                                                                 |
| 6   | Workers | Simultaneous outgoing connections    | 6 concurrent, awaiting response headers                                                                               |
| 7   | Workers | Cron Triggers per account            | 5 (no separate minimum-interval limit documented)                                                                     |
| 8   | Workers | Compressed bundle size               | 3 MB gzip (64 MB before compression, both plans)                                                                      |
| 9   | Workers | Static Assets file count             | 20,000 files per Worker version                                                                                       |
| 10  | Workers | Static Assets per-file size          | 25 MiB                                                                                                                |
| 11  | D1      | Rows read/day                        | 5,000,000                                                                                                             |
| 12  | D1      | Rows written/day                     | 100,000                                                                                                               |
| 13  | D1      | Total storage per account            | 5 GB                                                                                                                  |
| 14  | D1      | Max size of a single database        | 500 MB (**different from #13**)                                                                                       |
| 15  | D1      | Databases per account                | 10                                                                                                                    |
| 16  | D1      | Row / statement / parameter limits   | 2,000,000-byte (2 MB) max row size; 100 columns/table; 100,000-byte max SQL statement; 100 bound parameters/query     |
| 17  | D1      | Time Travel retention                | 7 days                                                                                                                |
| 18  | R2      | Free storage                         | 10 GB-month/month (Standard storage only)                                                                             |
| 19  | R2      | Class A operations                   | 1,000,000/month free                                                                                                  |
| 20  | R2      | Class B operations                   | 10,000,000/month free                                                                                                 |
| 21  | R2      | Egress fees                          | None — "no charges for egress bandwidth for any storage class"                                                        |
| 22  | Pages   | Projects per account                 | 100 (soft cap, "not routinely increased")                                                                             |
| 23  | Pages   | Builds                               | 500 builds/month, 1 concurrent build, 20-minute build timeout                                                         |
| 24  | Pages   | Files per deployment                 | up to 20,000                                                                                                          |
| 25  | Pages   | Per-file size                        | 25 MiB                                                                                                                |
| 26  | Pages   | Preview deployments                  | Unlimited active previews per project; auto-preview applies to same-repo branches/PRs, **not** to fork-originated PRs |
| 27  | Pages   | "Unlimited" claim                    | Confirmed, but scoped: **static-asset requests only**, not Functions/dynamic requests or "unlimited sites"            |

Two items could **not** be fully verified from a dedicated official page (flagged again in detail
below): the exact wording of Cloudflare's generic error-code page for **1027**, and any documented
minimum interval between Cron Trigger firings beyond standard cron syntax.

---

## Workers (Free plan)

### 1. Daily request limit

- **Current value:** 100,000 requests/day, reset at 00:00 UTC.
- **Source:** https://developers.cloudflare.com/workers/platform/limits/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** The anonymous public audit form and any organic traffic to the marketing
  pages all count against this shared per-account daily ceiling, as does every cron-driven
  monitoring-sweep invocation and its internal fetches routed through the Worker. A single scan
  that does several sequential fetches internally does _not_ multiply this counter (subrequests
  are a separate limit, see below) — but each inbound HTTP hit to the Worker (page views, API
  calls, the audit endpoint) does.
- **Monitoring method:** Cloudflare dashboard → Workers & Pages → Analytics (request count vs.
  time); error code **1027** appears in Worker responses once the daily ceiling is hit (see caveat
  under Pages/Errors section below — the dedicated 1027 error page could not be independently
  confirmed). An internal request counter (e.g. incrementing a KV/D1 counter per request) would
  give earlier warning than waiting for 1027s to appear.
- **Recommended warning threshold:** 60% of 100,000 (60,000 requests/day) sustained for 2+
  consecutive days.
- **Recommended upgrade threshold:** 80% sustained for 3+ consecutive days, or any single day
  hitting 100% (users seeing 1027s is a hard failure mode, not just a warning).

### 2. CPU time limit per invocation

- **Current value:** 10 ms per HTTP request invocation; 10 ms per Cron Trigger invocation.
- **Source:** https://developers.cloudflare.com/workers/platform/limits/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** This is the single tightest constraint for a scanner-style app. 10 ms of
  actual CPU (not wall-clock/network wait time) must cover request parsing, D1 query
  construction, response building, and any HTML/robots.txt parsing done synchronously per scan
  step. Network I/O (the safe-fetch chokepoint's outbound calls) does not count against CPU time,
  but parsing the fetched bodies does.
- **Monitoring method:** Error code **1102** ("Worker exceeded resource limits" /
  "Exceeded CPU Time Limits" in the dashboard) — confirmed via
  https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1102/
  and cross-referenced against https://developers.cloudflare.com/workers/observability/errors/.
  Note: the generic 1xxx status-code index page (`.../cloudflare-1xxx-errors/`) lists 1102 as a
  generic "Rendering error" — the Workers-specific meaning ("CPU time or memory limit exceeded")
  is documented separately on the Workers observability page, so both sources are cited rather
  than treating either alone as definitive. Also visible in the dashboard's "Errors by invocation
  status" chart, and via `wrangler tail` in real time.
- **Recommended warning threshold:** Any occurrence of 1102/CPU-exceeded in production logs
  (this is a hard per-request failure, not a gradual approach — there is no safe "60%" zone once
  a single request trips it).
- **Recommended upgrade threshold:** More than an isolated one-off — recurring 1102s on the same
  code path is the signal to move that Worker to a Paid plan (5-minute CPU budget) or restructure
  the hot path.

### 3. Worker memory limit

- **Current value:** 128 MB per isolate (shared across concurrent requests handled by that
  isolate — same figure on Free and Paid).
- **Source:** https://developers.cloudflare.com/workers/platform/limits/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** Relevant if a scan buffers a full page/robots.txt response body in memory
  before parsing, or if many concurrent scan requests land on the same isolate. Not plan-gated
  (Paid doesn't raise this), so no upgrade fixes a memory problem — only code changes
  (streaming/chunked parsing) do.
- **Monitoring method:** "Script startup exceeded memory limit" during deploy; "Exceeded Memory"
  in the dashboard's per-invocation error chart during execution.
- **Recommended warning threshold:** Any occurrence in production logs (there's no plan upgrade
  path — treat every occurrence as a code-level bug to fix, not a capacity metric to trend).
- **Recommended upgrade threshold:** N/A — this limit is identical on the Paid plan, so
  "upgrading" is not the remedy; refactor the offending code path instead.

### 4. External subrequest limit per request

- **Current value:** 50 subrequests per incoming request (Free); 10,000 on Paid.
- **Source:** https://developers.cloudflare.com/workers/platform/limits/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** Directly relevant — a single scan doing "several sequential fetches" (the
  page itself, robots.txt, sitemap, DNS-adjacent lookups, etc., all through the safe-fetch
  chokepoint in `packages/scanner`) consumes this budget per audit request. 50 is comfortable
  today for a handful of fetches per scan but would become a real constraint if scans are
  broadened (e.g. crawling multiple pages per audit, or checking several crawler user-agents per
  fetch target).
- **Monitoring method:** No distinct public error code confirmed for this one specifically
  during this verification pass; Cloudflare's general guidance is that exceeding it throws a
  `Too many subrequests` exception visible via `wrangler tail` / Workers Logs
  (`$metadata.error EXISTS`). An internal per-scan subrequest counter in `packages/scanner` would
  give the most precise, code-level visibility.
- **Recommended warning threshold:** Any single scan approaching 30 (60%) of the 50-subrequest
  budget should be logged/flagged for review of scan scope.
- **Recommended upgrade threshold:** A scan design that would routinely need >40 (80%) external
  fetches per audit is a signal to either reduce fetches per scan or move to the Paid plan
  (10,000/request).

### 5. Internal-service-binding subrequest limit

- **Current value:** 1,000 per request (Free) — distinct from, and far higher than, the 50-limit
  above; this covers calls to bound services (e.g. Worker-to-Worker via service bindings), not
  fetches to arbitrary external URLs.
- **Source:** https://developers.cloudflare.com/workers/platform/limits/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** Not currently relevant — CrawlPact is a single Worker with no service
  bindings to other Workers today. Would matter only if the architecture is later split into
  multiple bound Workers.
- **Monitoring method:** N/A today (no service bindings exist in `wrangler.jsonc`).
- **Recommended warning threshold:** N/A until service bindings are introduced.
- **Recommended upgrade threshold:** N/A until service bindings are introduced.

### 6. Simultaneous outgoing-connection limit

- **Current value:** 6 concurrent connections awaiting response headers per request (same figure
  on Free and Paid).
- **Source:** https://developers.cloudflare.com/workers/platform/limits/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** If a scan ever parallelizes its "several sequential fetches" (e.g.
  fetching robots.txt and sitemap.xml concurrently rather than sequentially) it must stay under 6
  in-flight connections per request. Since the brief describes CrawlPact's scans as sequential
  fetches, this is currently not a binding constraint but would matter immediately if scans were
  parallelized for latency.
- **Monitoring method:** Exceeding this throws a runtime exception on the offending `fetch()` call
  — visible via `wrangler tail` / Workers Logs exception filters.
- **Recommended warning threshold:** Any code change that introduces more than 3 (50%) concurrent
  in-flight fetches per scan should be flagged in review.
- **Recommended upgrade threshold:** N/A — this figure does not change between Free and Paid;
  the fix is sequencing/queuing fetches, not upgrading.

### 7. Cron Trigger limit

- **Current value:** 5 triggers per account (Free) vs. 250 (Paid). No separate documented limit
  on invocation _frequency_ was found beyond what standard cron syntax expresses (i.e., Cloudflare
  does not appear to publish a minimum-interval floor distinct from cron syntax itself on the
  limits page).
- **Source:** https://developers.cloudflare.com/workers/platform/limits/ (trigger count);
  https://developers.cloudflare.com/workers/configuration/cron-triggers/ (frequency — this page
  only cross-references the limits page and states no additional frequency restriction).
- **Date verified:** 2026-07-26
- **CrawlPact impact:** CrawlPact currently declares one cron trigger (`"0 3 * * *"`, daily at
  03:00 UTC, per `docs/deployment/CLOUDFLARE_CONFIGURATION.md`), driving both the monitoring
  sweep and the data-retention purge from a single `scheduled()` handler. This is 1 of the 5
  Free-plan triggers — comfortable headroom for now.
- **Monitoring method:** Cloudflare dashboard → Workers & Pages → Triggers tab shows configured
  cron count directly; not something that needs runtime monitoring since it's a static
  configuration limit, not a usage-based one.
- **Recommended warning threshold:** N/A (static count, not usage-based) — simply track before
  adding a second/third cron trigger that the account stays under 5.
- **Recommended upgrade threshold:** Needing a 6th distinct cron schedule.

### 8. Worker compressed-bundle size limit

- **Current value:** 3 MB after gzip compression (Free) vs. 10 MB (Paid); 64 MB before
  compression on both plans.
- **Source:** https://developers.cloudflare.com/workers/platform/limits/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** The Astro-built Worker bundle (app code + `@simplewebauthn/server` +
  `@paddle/paddle-node-sdk` + scanner package) must stay under 3 MB gzipped to deploy on Free.
  This is a real, growing constraint as dependencies are added — worth checking with
  `wrangler deploy --outdir bundled/ --dry-run` (the check command Cloudflare's own docs
  recommend) before each release.
- **Monitoring method:** `wrangler deploy --outdir bundled/ --dry-run` locally/in CI to measure
  compressed size before it hits Cloudflare's hard deploy-time rejection; deploy fails outright
  (not a runtime error) once exceeded.
- **Recommended warning threshold:** 60% of 3 MB (≈1.8 MB gzipped) — add a CI check that warns
  once bundle size crosses this.
- **Recommended upgrade threshold:** 80% (≈2.4 MB) sustained growth trend, or any deploy that
  actually fails the 3 MB cap — at that point either trim dependencies or move to Paid (10 MB).

### 9 & 10. Workers Static Assets — file count and per-file size

- **Current value:** 20,000 files per Worker version, 25 MiB max per individual file (Free);
  100,000 files on Paid, same 25 MiB per-file cap on both.
- **Source:** https://developers.cloudflare.com/workers/platform/limits/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** Covers Astro's built static output served via the `ASSETS` binding
  (`docs/deployment/CLOUDFLARE_CONFIGURATION.md`). A marketing/dashboard site's static output is
  very unlikely to approach 20,000 files or a single 25 MiB asset today, but is worth a periodic
  sanity check as the app grows (e.g. large generated reports, embedded fonts/images).
- **Monitoring method:** Deploy-time failure if exceeded (`wrangler deploy` rejects the upload);
  can also be checked proactively with `find dist -type f | wc -l` and a max-file-size scan in CI.
- **Recommended warning threshold:** 60% of 20,000 files (12,000), or any single asset exceeding
  15 MiB (60% of 25 MiB).
- **Recommended upgrade threshold:** 80% of either limit sustained, or an actual deploy-time
  rejection.

---

## D1 (Free plan / Workers Free)

### 11. Daily rows-read allowance

- **Current value:** 5,000,000 rows read/day, reset at 00:00 UTC.
- **Source:** https://developers.cloudflare.com/d1/platform/pricing/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** Every scan write and every dashboard/report read against D1 consumes this
  budget. 5M/day is generous for CrawlPact's current scale (occasional public audits + daily
  monitoring sweep), but a badly-indexed query scanning full tables repeatedly could burn through
  it faster than request volume alone would suggest.
- **Monitoring method:** Cloudflare dashboard → D1 → your database → Metrics (rows read/written
  over time); the D1 API returns an explicit error once the daily limit is exceeded ("D1 API will
  return errors to your client indicating that your daily limits have been exceeded" per
  Cloudflare's own docs), so client-visible failures are the hard signal. An internal query-level
  counter is not needed if the dashboard metric is checked regularly.
- **Recommended warning threshold:** 60% of 5,000,000 (3,000,000 rows/day) sustained.
- **Recommended upgrade threshold:** 80% (4,000,000/day) sustained, or any actual client-facing
  D1 error from limit exhaustion (a hard failure, not just a warning).

### 12. Daily rows-written allowance

- **Current value:** 100,000 rows written/day.
- **Source:** https://developers.cloudflare.com/d1/platform/pricing/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** Far more constraining than the read allowance for a scanner/monitoring
  app — every scan result, audit-log row, and monitoring-sweep write counts here. Daily
  cron-driven monitoring sweeps across many domains, each writing scan results, could approach
  this meaningfully sooner than the read limit as the monitored-domain count grows.
- **Monitoring method:** Same D1 dashboard metrics panel as above; client-facing D1 write errors
  are the hard signal once exhausted. Given this is the tighter of the two daily allowances, an
  internal counter (increment on each write inside the scan/monitoring write path) is worth adding
  proactively rather than relying solely on the dashboard.
- **Recommended warning threshold:** 60% of 100,000 (60,000 rows/day).
- **Recommended upgrade threshold:** 80% (80,000/day) sustained — given this is the limit most
  likely to bind first as monitored-domain count scales, treat sustained 80% as a concrete
  Paid-plan trigger, not just a watch item.

### 13. Total D1 storage included on the account (Free plan)

- **Current value:** 5 GB total, across all databases on the account.
- **Source:** https://developers.cloudflare.com/d1/platform/limits/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** This is the account-wide ceiling, shared across the production database
  and the preview database that `CLOUDFLARE_CONFIGURATION.md` requires as two distinct D1
  instances. Both count against this single 5 GB pool.
- **Monitoring method:** Cloudflare dashboard → D1 → account-level storage total; `wrangler d1
info <db-name>` per database to sum manually if the dashboard doesn't aggregate directly.
- **Recommended warning threshold:** 60% of 5 GB (3 GB) combined across both databases.
- **Recommended upgrade threshold:** 80% (4 GB) combined, or projected to hit the ceiling within
  the data-retention window before the retention purge (`lib/data-retention.ts`) would reclaim
  space.

### 14. Maximum size of a single D1 database

- **Current value:** 500 MB per individual database. **This is a different number from #13's 5 GB
  account-wide total** — a single database cannot grow to fill the whole account allowance; each
  one is separately capped at 500 MB regardless of how much of the 5 GB pool is otherwise unused.
- **Source:** https://developers.cloudflare.com/d1/platform/limits/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** This is the more binding constraint of the two in practice: with
  production and preview databases both capped individually at 500 MB, the production database
  cannot grow past 500 MB even though the account has 5 GB of combined headroom. Scan history,
  audit logs, and monitoring results all accumulate in the single production database, so 500 MB
  — not 5 GB — is the number that data-retention policy (`lib/data-retention.ts`) needs to keep
  ahead of.
- **Monitoring method:** `wrangler d1 info crawlpact-db --config apps/web/wrangler.jsonc` reports
  per-database size directly; also visible per-database in the D1 dashboard panel.
- **Recommended warning threshold:** 60% of 500 MB (300 MB) for the production database
  specifically.
- **Recommended upgrade threshold:** 80% (400 MB) — at this point either the data-retention purge
  cadence needs tightening or the account needs to move to Paid (10 GB per database).

### 15. Number of databases allowed

- **Current value:** 10 databases per account (Free) vs. 50,000 (Paid).
- **Source:** https://developers.cloudflare.com/d1/platform/limits/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** CrawlPact uses 2 today (production + preview per
  `CLOUDFLARE_CONFIGURATION.md`), well under the 10-database Free cap. Only becomes relevant if
  more environments (e.g. a third staging tier) are introduced.
- **Monitoring method:** Static configuration count — visible directly in the D1 dashboard list
  or `wrangler d1 list`.
- **Recommended warning threshold:** N/A (usage is 2 of 10; not a usage-growth metric to trend).
- **Recommended upgrade threshold:** Needing an 11th database.

### 16. Row size / BLOB size limits within a D1 database

- **Current value:** Maximum row size 2,000,000 bytes (2 MB); maximum 100 columns per table;
  maximum SQL statement length 100,000 bytes (100 KB); maximum 100 bound parameters per query;
  maximum SQL query duration 30 seconds. (These did not appear to be plan-differentiated in the
  fetched documentation — they read as fixed D1 engine limits rather than Free-vs-Paid figures.)
- **Source:** https://developers.cloudflare.com/d1/platform/limits/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** Scan result payloads (parsed robots.txt content, headers, findings JSON
  blobs) stored per row should comfortably stay well under 2 MB per row for the foreseeable
  future, but this is worth validating explicitly if raw response bodies are ever stored verbatim
  rather than summarized/parsed findings.
- **Monitoring method:** D1 rejects oversized writes at query time with an explicit SQL error —
  this surfaces as an application-level write failure, catchable in the scanner/write path's
  existing error handling.
- **Recommended warning threshold:** Any row payload approaching 1.2 MB (60% of 2 MB) in
  application-level logging/validation before insert.
- **Recommended upgrade threshold:** N/A — no Paid-plan change to this specific figure was found;
  remedy is schema/payload design, not an account upgrade.

### 17. D1 Time Travel retention period

- **Current value:** 7 days (Free) vs. 30 days (Paid). Additionally, up to 10 restore operations
  per 10 minutes per database (not plan-differentiated in the source).
- **Source:** https://developers.cloudflare.com/d1/reference/time-travel/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** Point-in-time recovery for the production D1 database only reaches back 7
  days on Free. Combined with the data-retention purge logic in `lib/data-retention.ts`, this
  means any data-integrity incident discovered more than a week after the fact cannot be
  recovered via Time Travel — a real operational constraint worth naming explicitly if not
  already covered in `docs/status/KNOWN_RISKS.md`.
- **Monitoring method:** Not a usage metric to monitor — it's a fixed recovery-window property.
  Worth periodically confirming (e.g. quarterly) that no operational assumption relies on
  recovery beyond 7 days.
- **Recommended warning threshold:** N/A (fixed window, not a consumable quota).
- **Recommended upgrade threshold:** Any incident-response requirement for >7-day recovery
  windows is a concrete case for moving to Paid (30 days).

---

## R2 (not currently used by CrawlPact — forward-looking)

### 18. Free monthly storage included

- **Current value:** 10 GB-month/month of Standard storage. Explicitly does **not** apply to
  Infrequent Access storage class.
- **Source:** https://developers.cloudflare.com/r2/pricing/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** Not applicable today — no R2 binding exists in `wrangler.jsonc`. Relevant
  only if/when CrawlPact adopts R2 (e.g. for storing raw scan snapshots or exported reports).
- **Monitoring method:** N/A until adopted; would be R2 dashboard storage metrics.
- **Recommended warning/upgrade thresholds:** N/A until adopted.

### 19. Included Class A operations

- **Current value:** 1,000,000 requests/month free (Class A = writes/list-type operations).
- **Source:** https://developers.cloudflare.com/r2/pricing/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** Not applicable today (no R2 usage).
- **Monitoring/threshold:** N/A until adopted.

### 20. Included Class B operations

- **Current value:** 10,000,000 requests/month free (Class B = reads).
- **Source:** https://developers.cloudflare.com/r2/pricing/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** Not applicable today (no R2 usage).
- **Monitoring/threshold:** N/A until adopted.

### 21. R2 egress-fee behavior

- **Current value/wording:** "There are no charges for egress bandwidth for any storage class,"
  and egressing directly from R2 (via the Workers API, the S3-compatible API, and `r2.dev`
  domains) "does not incur data transfer (egress) charges and is free." Cloudflare's well-known
  "no egress fee" claim is confirmed as still current, worded without a hidden caveat beyond the
  storage-class scoping already noted for #18 (free _storage_ tier excludes Infrequent Access;
  the _egress-is-free_ claim itself is stated without that Standard/Infrequent Access
  qualification).
- **Source:** https://developers.cloudflare.com/r2/pricing/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** Not applicable today (no R2 usage), but a meaningful future advantage if
  CrawlPact ever serves large report exports or archived scan artifacts from R2 instead of D1 —
  no egress cost risk to model in.
- **Monitoring/threshold:** N/A until adopted.

---

## Cloudflare Pages

_(Note: CrawlPact's `wrangler.jsonc` currently deploys as a single Worker with Static Assets, not
as a separate Pages project — these figures are recorded for completeness per the brief and in
case a Pages-based split is considered later.)_

### 22. Number of projects allowed

- **Current value:** "Cloudflare Pages has a limit of 100 projects per account. This limit is not
  routinely increased" (quoted verbatim).
- **Source:** https://developers.cloudflare.com/pages/platform/limits/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** Not currently relevant (no Pages projects in use); would matter only if a
  Pages-based architecture is adopted with many per-environment/preview projects.
- **Monitoring/threshold:** N/A while unused.

### 23. Build minutes / build count limits

- **Current value:** Free: 500 builds/month, 1 build at a time (no concurrent builds), 20-minute
  build timeout. (Pro: 5,000 builds/month, 5 concurrent; Business: 20,000/month, 20 concurrent.)
- **Source:** https://developers.cloudflare.com/pages/platform/limits/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** Not currently relevant — CrawlPact's CI/deploy path is Wrangler-based
  Worker deploys, not Pages builds.
- **Monitoring/threshold:** N/A while unused.

### 24. File-count limit per deployment

- **Current value:** Up to 20,000 files (Free); up to 100,000 files on paid plans (requires
  `PAGES_WRANGLER_MAJOR_VERSION=4` configuration per Cloudflare's docs).
- **Source:** https://developers.cloudflare.com/pages/platform/limits/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** Not currently relevant (mirrors the Workers Static Assets figure already
  covered in #9, which is what actually applies to CrawlPact's real deployment path).
- **Monitoring/threshold:** N/A while unused.

### 25. Preview-deployment behavior

- **Current value:** Every branch within the _same_ repository gets an automatic preview
  (a randomly-generated hash subdomain under `pages.dev`). Pull requests get automatic preview
  URLs **only when they originate from the repository itself** — fork-originated PRs do not get
  automatic previews. No documented limit on the number of concurrent or total preview
  deployments; Cloudflare states "You can have an unlimited number of preview deployments active
  on your project at a time" (quoted verbatim). The only related restriction found is that "the
  latest deployment for a branch cannot be deleted."
- **Source:** https://developers.cloudflare.com/pages/platform/limits/ (unlimited-previews quote)
  and https://developers.cloudflare.com/pages/configuration/preview-deployments/ (fork-PR caveat)
- **Date verified:** 2026-07-26
- **CrawlPact impact:** Not currently relevant (CrawlPact doesn't use Pages), but worth flagging
  for the brief: if Pages is adopted later, the "every branch/PR is automatically a preview"
  assumption is **only true for same-repo branches/PRs**, not forks — relevant if CrawlPact ever
  accepts external contributions via forked PRs.
- **Monitoring/threshold:** N/A while unused.

### 26. "Unlimited" claim for Pages

- **Current value/wording:** Confirmed present in current docs, but narrower than a blanket
  "Pages is unlimited": "On both free and paid plans, requests to static assets are free and
  unlimited" (quoted verbatim, from the Pages Functions pricing page) — this applies specifically
  to requests that **do not** invoke a Function (i.e., pure static-asset serving). It does **not**
  say Pages Functions/dynamic requests are unlimited (those count against the shared 100,000/day
  Workers-Free request limit, same as #1 above), and it does **not** say "unlimited sites" — the
  100-project cap (#22) still applies. **Flag: prior assumptions that "Pages is simply unlimited"
  are not supported by current docs without this static-vs-dynamic distinction — do not
  perpetuate the unqualified version of this claim.**
- **Source:** https://developers.cloudflare.com/pages/functions/pricing/
- **Date verified:** 2026-07-26
- **CrawlPact impact:** Not currently relevant (CrawlPact doesn't use Pages), but directly
  relevant to correcting any planning assumption elsewhere in the brief that treats "Pages" as an
  unlimited-capacity escape hatch — it is not, once Functions are involved.
- **Monitoring/threshold:** N/A while unused.

---

## Items flagged as NOT fully verifiable from a dedicated current official source

- **Error code 1027's dedicated documentation page** —
  `https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1027/`
  returned HTTP 404 on 2026-07-26. The index page at
  `.../cloudflare-1xxx-errors/` does not list 1027 at all among its documented codes. The
  association of 1027 with "Worker exceeded free tier daily request limit" comes from Workers
  observability documentation and consistent third-party/community reports, **not** from a
  dedicated first-party error-code page — treat this specific code mapping as reasonably
  confident but not verified with the same rigor as the numeric limits above.
- **Minimum interval/frequency restriction on Cron Triggers** — no dedicated Cloudflare page
  states a minimum-interval floor distinct from what cron syntax itself expresses (i.e., no
  documented "cron triggers cannot fire more often than X" statement was found beyond the
  trigger-count limit of 5). Recorded as "not found in current docs" rather than assumed absent.
- **Whether D1's row/statement/parameter limits (#16) are plan-differentiated** — the fetched D1
  limits page presented these as single figures without a Free/Paid split (unlike storage, rows
  read/written, and Time Travel, which are explicitly split). Recorded as apparently
  plan-uniform, not verified via an explicit "same on both plans" statement.

All other figures in this document were read directly from the cited `developers.cloudflare.com`
URLs on 2026-07-26 and are reported with the exact wording quoted where the brief requested it
(egress-fee wording, Pages project-limit wording, Pages "unlimited" wording).
