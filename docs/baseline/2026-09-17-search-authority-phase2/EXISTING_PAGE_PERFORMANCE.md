---
Document owner: Engineering owner
Status: current-authoritative (Phase 2, §2/§7-8 — existing-page performance check)
---

# Existing-Page Performance — First Real Data, 2026-09-18

The `growth_collection` scheduled job ran for the first time ever at `2026-09-18T03:01:00Z`
(`error_summary: "data_date=2026-09-17 gsc=ok(32) ga4=ok(6) crux=no_data"`). This confirms the
Phase 1 pipeline works end-to-end in Production — the mechanical blocker from `PHASE_2_BASELINE.md`
is now resolved. The data itself, however, is too thin to support §2 ("existing-page wins") or
§7-8 (opportunity sizing) analysis yet.

## What actually landed (real, live, queried directly)

**GSC** (32 rows, covering `2026-09-13` to `2026-09-15` — Search Console's normal 2-3 day
reporting lag means today's pull is the most recent available):

- Site-wide: 15 total impressions across 3 days (3, 2, 10), **0 clicks**, average position in the
  27-55 range depending on the day.
- Highest-volume single query: "are ai crawlers like gptbot blocked by default" — 1-2
  impressions/day, position ~99 (essentially unranked).
- Best-positioned real result: `/guides/amazonbot-vs-amzn-searchbot-vs-amzn-user/` for an
  unspecified query at position 1, but only 1 impression, 0 clicks — a single, isolated event, not
  a trend.
- No query or page in this window has more than 3 impressions. **Zero clicks anywhere.**

**GA4** (6 rows, `2026-09-17` only): 1 active user, 1 session, 0 engaged sessions, 0 key events,
landing on `/` via Direct/Unassigned channel, desktop.

**CrUX**: no data — the origin doesn't yet have enough real Chrome User Experience Report
traffic to populate a report. Expected at this traffic level, not a defect.

## What this means for Phase 2

This is one day of GA4 data and three days of GSC data, at a traffic level where single visits
dominate the numbers. Drawing conclusions like "these pages are winning" or "this topic has
demand" from 15 impressions and 1 session would be over-interpreting noise — exactly what
Phase 2's own anti-fabrication standard warns against, applied here to statistical inference
rather than content generation.

**Recommendation: keep collecting, don't yet run §2/§7-8 as originally scoped.** These sections
need enough accumulated volume that a "top query" or "underperforming page" claim reflects a real
pattern, not one visitor. Revisit after at least 2-4 weeks of continuous collection (the table is
append-only per day, so history will accumulate automatically without any further action). In the
meantime, §7's content inventory (`CONTENT_INVENTORY.md`) and the registry/research readiness
work (`REGISTRY_RELEASE_DECISION.md`, `RESEARCH_PUBLICATION_EVIDENCE.md`) remain the productive
tracks, since they don't depend on traffic volume.

## One legitimate early signal, reported cautiously

All 15 real impressions this window are for AI-crawler-identity queries (crawler names, "is X
blocked by default" style questions) landing on `/crawlers/*` and `/guides/*` comparison pages —
not on `/pricing` or `/` for commercial-intent terms. This is directionally consistent with
CrawlPact's existing content strategy (crawler-identity content, not commercial landing pages, is
what search is currently surfacing) but is far too small a sample (single-digit impressions per
query) to be treated as a confirmed pattern. Flagging it as a hypothesis to watch as more data
accumulates, not a finding to act on today.
