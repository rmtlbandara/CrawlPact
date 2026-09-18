---
Document owner: Engineering owner
Status: current-authoritative (Phase 2, §32-33 — search data maturity criteria)
---

# Search Data Maturity Criteria — 2026-09-18

Phase 2 explicitly rejects an arbitrary calendar rule ("wait 2-4 weeks") for when GSC/GA4
opportunity analysis becomes responsible. This document defines the concrete evidence thresholds
instead, so future passes can check real numbers against a fixed bar rather than re-litigating
the question each time.

## Current state (re-confirmed 2026-09-18)

- 1 collection run total (`2026-09-18T03:01 UTC`, covering GSC data through `2026-09-15` and GA4
  data for `2026-09-17`).
- GSC: 15 total impressions across 3 settled days, spread across ~6 distinct queries and ~10
  distinct pages, 0 clicks anywhere.
- GA4: 1 session, 1 active user, 1 day.
- No second collection run has occurred yet (next: `2026-09-19T03:00 UTC`).

## Criteria for starting opportunity analysis (§33)

All of the following must hold before treating a query/page pattern as signal rather than noise:

1. **At least 14 settled GSC days** — Search Console's own data has enough natural day-to-day
   variance (weekday/weekend, indexing lag) that fewer than two weeks makes any single day's
   spike or dip indistinguishable from normal noise.
2. **At least one query with impressions on 5+ distinct days** — a query appearing once and never
   again is far more likely to be a one-off, unrepresentative search than a real, recurring
   pattern worth prioritizing around.
3. **At least one page with impressions on 5+ distinct days**, independent of query — same
   reasoning, applied to pages rather than queries.
4. **Total impressions high enough that no single day accounts for more than ~40% of the trailing
   14-day total** — guards against one anomalous day (a bot-driven spike, a single viral share)
   dominating a comparison and being mistaken for a trend.
5. **At least one click recorded** — with 0 clicks, CTR is undefined and "high-impression,
   low-CTR" classification (§33) cannot be computed at all, only "has impressions, no clicks yet,"
   which is a different, weaker signal.

## Why these specific numbers

- 14 days and 5-occurrence thresholds are deliberately conservative given how small current
  volume is (15 impressions over 3 days) — with numbers this small, almost any pattern looks
  "significant" by chance. These thresholds require the same query or page to show up repeatedly
  before being trusted, not just accumulate more total volume on unrelated queries.
- The 40%-single-day cap is a concentration check, not a volume check — it stays relevant even
  after raw volume grows, since a single event (a Show HN post, a spike from this session's own
  distribution work) could otherwise dominate a small total indefinitely.

## What to do until criteria are met

Continue recording observations honestly (as `EXISTING_PAGE_PERFORMANCE.md` already does) without
computing opportunity classifications from them. Re-run this check against real numbers at each
future Phase 2 continuation rather than assuming a fixed number of weeks has "surely" been enough.
