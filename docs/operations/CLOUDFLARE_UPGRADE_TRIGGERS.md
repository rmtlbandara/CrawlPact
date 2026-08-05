# Cloudflare Upgrade Triggers

**Date:** 2026-07-26. Phase 12 of the Cloudflare infrastructure-alignment brief. Every numeric
limit referenced below is sourced from `docs/deployment/CLOUDFLARE_RESOURCE_LIMITS.md` (verified
live against `developers.cloudflare.com` on 2026-07-26) — this document does not re-derive limits,
it turns them into concrete operational thresholds.

CrawlPact holds no paid Cloudflare plan today. A real production account/zone/Worker has been
connected since 2026-07-26 (this line previously said no production account was connected at all —
corrected 2026-07-27); the zone remains on the Free plan (confirmed via a direct Cloudflare API
read). This document exists so that once real traffic exists, there is a pre-agreed answer to
"should we upgrade yet?" instead of that decision being made reactively during an incident.

Do not read this document as a promise that CrawlPact will remain on Cloudflare's Free plan
indefinitely — it explicitly is not. It defines when to stop assuming Free is sufficient.

**Re-verified live 2026-08-05 (Phase 11, Stage 11H)**: every Workers, D1, and R2 Free-plan figure
in this document was re-checked directly against `developers.cloudflare.com` (not re-derived from
the 2026-07-26 figures below). Confirmed unchanged, with no drift found: Workers daily requests
(100,000), CPU time (10 ms/invocation), subrequests (50/request), Worker size (3 MB), Cron
Triggers (5/account), static asset files (20,000)/per-file size (25 MiB); D1 rows read (5M/day),
rows written (100,000/day), account storage (5 GB total); R2 storage (10 GB-month), Class A
operations (1M/month), Class B operations (10M/month). The one figure not re-confirmed verbatim
this pass — D1's per-database 500 MB ceiling (distinct from the 5 GB account total) — returned
incomplete search results from this session's documentation tool; it is presumed unchanged (this
class of per-resource limit is not one Cloudflare has historically tightened) but should be
explicitly re-checked, not re-assumed, at the next real re-verification pass. See
`docs/operations/PHASE_11_CLOUDFLARE_PLAN_DECISION.md` for what this re-verification changes (or
doesn't) about the current plan decision.

## How to read this document

Each trigger has:

- **Warning threshold** — the point at which someone should look, not act yet.
- **Critical/action threshold** — the point at which a concrete action is expected.
- **Action** — what to actually do.
- **Responsible role** — for a solo-founder operation, this is the founder/on-call operator;
  recorded anyway so the process holds if the team grows.
- **How to measure** — the exact dashboard, command, or internal metric to check.
- **Expected upgrade path** — what upgrading actually buys, so the action isn't vague.

## Workers triggers

| Metric                                                    | Warning (60%)                                                                                                                                                | Critical/action (80%+)                                                                    | How to measure                                                                                   | Upgrade path                                                                                                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily requests (100,000/day)                              | 60,000/day sustained 2+ days                                                                                                                                 | 80,000/day sustained 3+ days, or any single day at 100% (hard failure — users see errors) | Cloudflare dashboard → Workers & Pages → Analytics; internal request counter for earlier warning | Workers Paid: no fixed daily request cap, billed per-request beyond included volume                                                                                     |
| CPU time per invocation (10ms)                            | Any occurrence of error 1102 ("CPU time or memory limit exceeded") in production logs — there is no safe gradual zone, a single request either fits or fails | Recurring 1102s on the same code path (not an isolated one-off)                           | `wrangler tail`, dashboard "Errors by invocation status"                                         | Workers Paid: 30 second wall-clock / effectively much larger CPU budget (5-minute CPU budget per Cloudflare's own Paid-plan documentation referenced in the limits doc) |
| External subrequests per scan (50 max)                    | A single scan approaching 30 (60%) external fetches                                                                                                          | A scan design routinely needing >40 (80%) fetches                                         | Internal per-scan subrequest counter in `packages/scanner`                                       | Workers Paid: 10,000 subrequests/request — effectively removes this as a constraint                                                                                     |
| Worker compressed bundle (3MB gzip)                       | ≥1.8MB (60%) gzipped bundle                                                                                                                                  | ≥2.4MB (80%), or an actual deploy rejection                                               | `wrangler deploy --outdir bundled/ --dry-run` in CI before each release                          | Workers Paid: 10MB gzip limit                                                                                                                                           |
| Cron Triggers (5/account)                                 | N/A — static config count, not usage-based                                                                                                                   | Needing a 6th distinct cron schedule                                                      | Dashboard → Workers & Pages → Triggers tab                                                       | Workers Paid: 250 triggers/account                                                                                                                                      |
| Static Assets file count (20,000) / per-file size (25MiB) | 12,000 files (60%), or any asset ≥15MiB (60%)                                                                                                                | 16,000 files (80%), or an actual deploy rejection                                         | `find dist -type f \| wc -l`; a max-file-size CI check                                           | Workers Paid: 100,000 files/version (same 25MiB per-file cap on both plans — this one is not solved by upgrading alone if a single asset exceeds 25MiB)                 |

**Overall Workers upgrade trigger** (the single most important line in this table): **recurring
CPU-limit (1102) failures on the audit-scan code path**, or **sustained 80%+ daily request usage**,
or **paid monitoring obligations (SRS §25's monthly/weekly cadence) cannot be completed reliably
within the free tier's constraints** (see `docs/operations/MONITORING_CAPACITY_PLAN.md`). Any one
of these is sufficient justification to move to Workers Paid — per the brief's own principle,
prefer a simple Paid upgrade over fragile architecture built solely to avoid it.

## D1 triggers

| Metric                                                                                                   | Warning (60%)                                                                                                              | Critical/action (75–80%)                                                                                                                                | How to measure                                                                                                      | Upgrade path                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rows read/day (5,000,000)                                                                                | 3,000,000/day sustained                                                                                                    | 4,000,000/day sustained, or a client-facing D1 read-limit error (hard failure)                                                                          | D1 dashboard metrics panel                                                                                          | Workers Paid: substantially higher D1 included allowances (see Cloudflare's current D1 pricing page at upgrade time — the exact Paid figure was not the subject of this verification pass, which focused on Free-plan limits) |
| Rows written/day (100,000)                                                                               | 60,000/day sustained                                                                                                       | 80,000/day sustained — **this is the daily allowance most likely to bind first** as monitored-domain count scales, since every scan writes several rows | D1 dashboard metrics panel; an internal write counter in the scan/monitoring write path is worth adding proactively | Same as above                                                                                                                                                                                                                 |
| **Single-database size (500MB — the binding per-database ceiling, distinct from the 5GB account total)** | 300MB (60%) for the production database specifically                                                                       | 400MB (80%) — tighten the data-retention purge cadence, or upgrade                                                                                      | `wrangler d1 info crawlpact-db --config apps/web/wrangler.jsonc`; D1 dashboard per-database panel                   | Workers Paid: 10GB per database                                                                                                                                                                                               |
| Total account storage (5GB, shared across production + preview)                                          | 3GB (60%) combined                                                                                                         | 4GB (80%) combined, or projected to hit the ceiling before the retention purge would reclaim space                                                      | Sum of `wrangler d1 info` across both databases                                                                     | Same as above                                                                                                                                                                                                                 |
| Time Travel window (7 days)                                                                              | N/A — fixed recovery window, not a consumable quota; confirm quarterly no operational assumption relies on >7-day recovery | Any real incident-response requirement for >7-day point-in-time recovery                                                                                | N/A (design-time check, not a runtime metric)                                                                       | Workers Paid: 30-day Time Travel window                                                                                                                                                                                       |

**Overall D1 action trigger**: the production database (not the account total — see
`docs/data/D1_STORAGE_CAPACITY_AUDIT.md` for why the per-database 500MB figure, not the 5GB
account figure, is the one that actually matters operationally) crossing 75–80% of its 500MB cap,
or retention/purge logic provably unable to keep growth under that ceiling given real usage.

## R2 triggers (adopted 2026-07-30 for agency-branding logo uploads only — thresholds below not yet activated for this narrow use case)

**Note added 2026-08-03 (Phase 1)**: R2 (`AGENCY_LOGOS` binding) was adopted 2026-07-30, after
this document was written — see `docs/data/D1_R2_DATA_PLACEMENT_POLICY.md`. Given the low
expected volume of this specific feature (one small image per agency-branded share, capped at 1
MiB), the triggers below have not yet been reviewed against it; routed to a future operations
review.

| Metric                                | Warning (60%)   | Critical/action (80%)                                                              |
| ------------------------------------- | --------------- | ---------------------------------------------------------------------------------- |
| Free storage (10GB-month)             | 6GB-month       | 8GB-month, or approaching the point where Standard-class free storage is exhausted |
| Class A operations (1,000,000/month)  | 600,000/month   | 800,000/month                                                                      |
| Class B operations (10,000,000/month) | 6,000,000/month | 8,000,000/month                                                                    |

These thresholds are recorded now so they exist the moment R2 is actually adopted (per one of the
five revisit triggers in `D1_R2_DATA_PLACEMENT_POLICY.md`) — there is nothing to measure against
them today since no R2 binding exists.

## Pages triggers

Not applicable — CrawlPact does not use Cloudflare Pages (see ADR-0006). Recorded for completeness
only if that decision is ever revisited: 100 projects/account (soft cap), 500 builds/month on
Free.

## Process

1. Whichever role is on call (today: the founder) checks the "How to measure" column periodically
   — there is no automated paging system for these thresholds yet (an internal Super Admin
   capacity-visibility view is planned per `docs/status/IMPLEMENTATION_STATUS.md`, not built in
   this pass).
2. Hitting a **warning** threshold means: look at the trend, don't panic. Note it, watch it over
   the next check.
3. Hitting a **critical/action** threshold means: either apply the specific tightening measure
   listed (retention cadence, bundle trimming, scan-scope reduction) or upgrade — do not leave it
   unaddressed.
4. Never treat a warning-threshold breach as a reason to silently reduce monitoring frequency or
   plan entitlements (a non-negotiable rule from the source brief) — the response to capacity
   pressure is tightening internal efficiency or upgrading the plan, never quietly delivering less
   than what a customer is paying for.
