# Phase 11 Cloudflare plan decision

Stage 11H. Current plan, real measured usage, a growth projection, the trigger thresholds this
usage is measured against, and an explicit Free-sufficiency verdict. **This document does not
upgrade anything** — CrawlPact remains on Cloudflare's Free plan; per this phase's own scope
boundary, activating a paid plan requires separate, explicit, in-the-moment approval, never an
automatic action taken as part of a hardening pass.

## Current plan (confirmed live)

**Workers Free.** No Workers Paid subscription exists on this account (confirmed via a direct
Cloudflare API read, `docs/performance/PHASE_11_PRODUCTION_CAPACITY_BASELINE.md` §8.1). R2's
pay-as-you-go metering (`r2_paid`) is active, adopted 2026-07-30 alongside the `AGENCY_LOGOS`
bucket — this is R2's standard usage-based billing activation (R2 has no separate "free plan"
subscription the way Workers does; the free 10 GB-month/1M/10M allowances above apply
automatically), not evidence of a paid-tier decision or of meaningful real usage.

## Real measured usage (Stage 11A baseline, 2026-08-05)

| Metric                                |       Real measured value |                                 Free-plan limit |                                                                              % of limit |
| ------------------------------------- | ------------------------: | ----------------------------------------------: | --------------------------------------------------------------------------------------: |
| Production D1 database size           | 3,461,120 bytes (~3.3 MB) |                           500 MB (per-database) |                                                                                   0.69% |
| Cron Triggers configured              |                         1 |                                       5/account |                                                                                     20% |
| Worker error events (7-day window)    |                         0 |         N/A (no CPU-limit/1102 errors observed) |                                                                                       — |
| Largest real monitoring sweep to date |        4 domains selected | 20/sweep default (`monitoring_scan_batch_size`) | 20% of the configured batch cap, itself far under any Workers-level request/CPU ceiling |
| Real users / saved domains            |                     2 / 9 |                                             N/A |                                                                                       — |

Every measured figure is far below every Free-plan threshold — none within even the 60% "warning"
band this document's companion (`CLOUDFLARE_UPGRADE_TRIGGERS.md`) defines. This matches RISK-008's
own framing exactly: real, structural risk at the SRS's stated commercial target (150+
domains/1,000 users), not an active problem at today's real volume.

## Growth projection

Using the real per-scan storage cost this phase measured and then reduced
(`docs/performance/PHASE_11_STORAGE_OPTIMISATION_DESIGN.md`): pre-Phase-11, real raw bytes/scan
were measured at ≈68,000 bytes/scan (§8.2 of the baseline doc), dominated by `html_meta` (53,554
bytes avg) and `sitemap` (20,891 bytes avg). This phase's minimised-evidence change to both
(§ storage optimisation design doc) reduces each to a few hundred bytes, cutting the two largest
contributors by roughly two orders of magnitude — the realistic post-Phase-11 per-scan storage
cost is much closer to the original Phase 5 "as-observed" estimate (~21,700 bytes/scan) than the
pre-fix measured figure, though re-measuring this in production (not just projecting from local
benchmarks) is Stage 11I's job, not this document's.

At the SRS's commercial target (150+ domains, weekly monitoring per Pro-tier cadence): roughly
150 × 4 scans/month × 12 months × ~22 KB/scan (a conservative post-fix estimate, rounding up from
the ~21.7 KB Phase 5 figure) ≈ **158 MB/year of pure scan-resource growth at that specific target
scale** — well under the single-database 500 MB Free-plan ceiling even accounting for other
tables' growth (findings, scan_crawler_results, notifications, etc.), though this projection does
not account for retention purging already reclaiming space for expired history, which would only
improve this picture, not worsen it. This is a rough order-of-magnitude sanity check, not a
substitute for Stage 11I's real re-measurement once the storage changes are live.

## Free-sufficiency verdict

**Free remains sufficient today, and the growth projection above does not identify an imminent
need to upgrade even at the SRS's stated commercial target**, provided:

1. The Stage 11D retention hardening (chunked, bounded purges) continues running as designed —
   confirmed working in this phase's own real D1 integration tests.
2. The Stage 11C/11F storage and query optimisations (findings cap, `html_meta`/`sitemap`
   minimisation, the new composite monitoring index) are deployed and remain in place — this
   verdict assumes the state of the codebase _after_ this phase's changes, not before them.
3. Real monitoring/scan volume tracks the SRS's stated targets rather than growing unboundedly
   past them without a corresponding retention/pricing review.

**This verdict is not permanent.** It should be revisited whenever `CLOUDFLARE_UPGRADE_TRIGGERS.md`'s
own thresholds are approached in real measured data (not projected), per that document's existing
"warning at 60%, action at 75–80%" structure — this document does not change those thresholds, it
only records that current real usage sits far below them.

## Financial-approval status

**No paid Cloudflare plan is activated or requested by this phase.** Per the Phase 11 prompt's own
explicit scope boundary ("never activate a Cloudflare paid plan... without separate explicit
approval"), this document is evidence and a recommendation, not an authorization. If a future
measurement crosses `CLOUDFLARE_UPGRADE_TRIGGERS.md`'s action thresholds, the next step is a
distinct, explicit conversation with the founder about the specific upgrade cost (Workers Paid:
$5/month base + usage; see `docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md` and Cloudflare's own
current pricing page at decision time) — not an automatic upgrade triggered by this or any other
document.
