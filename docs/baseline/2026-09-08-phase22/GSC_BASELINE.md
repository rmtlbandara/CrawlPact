# Phase 22 GSC Baseline

**Property**: `sc-domain:crawlpact.com`. **Settled end date**: 2026-09-06 — determined by querying
the `date` dimension with `dataState: "final"` over a 12-day lookback window and taking the latest
date actually returned (2026-08-27 through 2026-09-06 were all returned as final; 2026-09-07 and
2026-09-08 were not yet settled at query time). This is one day more recent than Phase 20's
2026-09-05 baseline.

## Site totals (no-dimension query — not summed from per-query/per-page rows)

| Window           | Range                   | Clicks | Impressions | CTR    | Avg. position |
| ---------------- | ----------------------- | ------ | ----------- | ------ | ------------- |
| 28 days          | 2026-08-10 → 2026-09-06 | 3      | 888         | 0.338% | 61.56         |
| 90 days          | 2026-06-09 → 2026-09-06 | 6      | 1,349       | 0.445% | 64.41         |
| 14 days          | 2026-08-24 → 2026-09-06 | 1      | 302         | 0.331% | 56.76         |
| Previous 14 days | 2026-08-10 → 2026-08-23 | 2      | 586         | 0.341% | 64.03         |
| Previous 28 days | 2026-07-13 → 2026-08-09 | 3      | 461         | 0.651% | 69.91         |

The most recent 14 days show _fewer_ impressions than the 14 days before them (302 vs 586), while
the most recent 28 days show _more_ impressions than the 28 days before them (888 vs 461). These
two comparisons point in opposite directions on the same underlying data — exactly the kind of
noisy, small-sample pattern the phase prompt's own Section 9 warns against overinterpreting at
CrawlPact's current traffic volume. No growth or decline claim is made from either comparison;
both are recorded as raw evidence for the T0 baseline `MEASUREMENT_CHECKPOINTS` will compare
against later, not as a conclusion about current trajectory.

Compare to Phase 20's own 28d baseline (2026-08-09 → 2026-09-05: 3 clicks, 954 impressions, 0.314%
CTR, avg. position 62.58) and 90d baseline (6 clicks, 1,344 impressions, 0.446% CTR, avg. position
64.59). The one-day-later window shows very similar totals (888 vs 954 impressions, 61.56 vs 62.58
avg. position) — a small movement, fully explainable by the shifted date range and normal
day-to-day noise at this traffic volume. **This is not framed as a trend** — per the phase
prompt's own Section 9, a 1-day-shifted comparison on a site this size is not a meaningful
before/after signal.

## Data limitations (apply to every table in this evidence package)

- Search Console omits some low-volume queries for privacy and truncates lower-priority rows —
  query-table impressions do not sum to the site total above in every case. Two concrete examples
  found this phase: `/platforms/vercel/` (43 90-day impressions at the page level) and
  `/guides/metas-four-crawlers-explained/` (19 90-day impressions at the page level) each had only
  1-2 impressions' worth of individually-named queries in the `query×page` export — the rest are
  suppressed, low-volume queries GSC does not name individually. This phase does not guess what
  those suppressed queries are.
- "Impressions" means CrawlPact appeared in a qualifying Google result — never described as
  "search volume," "keyword volume," or "market demand" anywhere in this package.
- "Average position" is reported as "~N" or "position context," never as a fixed rank claim.
- CTR is never interpreted without its accompanying position — see `SEO_OPPORTUNITY_REGISTER.md`
  for why the site's near-universal 0% CTR on deep-visibility pages (position 60-95) is not treated
  as a title/snippet defect.

## Canonical-URL normalization

Phase 20's canonical policy (trailing slash for every indexable page except `/`) means historical
and even some current GSC rows still carry both a slash and non-slash form for the same content
identity (e.g. `/crawlers/amazonbot` and `/crawlers/amazonbot/` both appear in the raw 90-day
export). Every page-level table in this package (`GSC_CANONICAL_NORMALIZED_PAGE_MATRIX.md`) merges
these before drawing any conclusion — raw, un-merged data is preserved in the local GSC tooling
output directory (`~/.config/crawlpact-gsc/output/phase22/2026-09-06/`, not committed to the
repository) for reproducibility, per the phase prompt's explicit instruction not to commit raw
credential-adjacent exports unnecessarily.

## Dimensions captured

`date`, `query`, `page`, `query×page`, `device`, `country` for both 28d and 90d windows, plus a
`searchAppearance` dimension query for both windows (see `GENERATIVE_AI_SEARCH_VISIBILITY.md` for
why it returned 0 rows and what that does and doesn't mean).

## Reproduction

The export script used (`~/.config/crawlpact-gsc/export_search_console_phase22.py`, local tooling,
not part of this repository) reuses the existing Phase 20 script's authentication and query
pattern, writing to a dedicated `output/phase22/2026-09-06/` namespace rather than overwriting
Phase 20's own preserved evidence directory. No credential file (`client_secret.json`, `token.json`)
was read, printed, copied, or referenced by value anywhere in this package or the repository.
