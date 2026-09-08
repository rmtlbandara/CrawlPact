---
Document owner: Engineering owner
Status: current-authoritative
Date: 2026-09-08
---

# Search Console baseline — real, independently-verified data (Phase 20, Day 2)

Source: `sc-domain:crawlpact.com`, direct read-only Google Search Console API access via
`~/.config/crawlpact-gsc/`. All figures below were read from already-exported local JSON/CSV
files or produced by local analysis scripts that operate only on that already-exported data — no
additional API calls were made beyond what had already run before this session (bulk URL
Inspection was **not** re-run, per instruction). No OAuth credentials were read, printed, or
reproduced.

This supersedes 2026-09-07's `SEARCH_CONSOLE_BASELINE.md`, whose figures were explicitly labeled
"externally supplied, not independently re-queried." These are independently queried.

## Settled date / permission

- Permission: `siteOwner`
- Latest settled date: 2026-09-05

## Performance — always label the date range

| Window                            | Clicks | Impressions |    CTR | Avg. position |
| --------------------------------- | -----: | ----------: | -----: | ------------: |
| 28 days (2026-08-09 → 2026-09-05) |      3 |         954 | 0.314% |         62.58 |
| 90 days                           |      6 |       1,344 | 0.446% |         64.59 |

These two windows are **not** the same underlying period as each other and must never be
averaged or compared as if they were — the 28-day window is a subset of the 90-day one, and both
are still growing as more days settle.

## Brand vs. non-brand (28 days)

|                                                     | Clicks | Impressions |   CTR |
| --------------------------------------------------- | -----: | ----------: | ----: |
| Brand (`crawlpact`, `crawl pact`, obvious variants) |      0 |           0 |     — |
| Non-brand                                           |      0 |         292 | 0.00% |

**Zero brand-query impressions in both the 28-day and 90-day windows** (independently confirmed:
0 of 87 28-day query rows and 0 of 115 90-day query rows contain "crawlpact" or "crawl pact").
This is a genuine, currently-accurate reading, not a script defect — consistent with a young site
that has not yet accumulated direct-navigation/brand-recall search behavior. It should not be
read as a technical problem; there is nothing for Phase 20 to fix here. Note also GSC's own
anonymization: very-low-volume query rows can be excluded entirely from the query-level report
even though they still count toward the page-level and site-level totals — so "0 brand rows"
describes what GSC surfaced at the query level, not a guarantee that literally zero brand searches
occurred.

## Devices (28 days)

| Device  | Impressions | Clicks |   CTR | Avg. position |
| ------- | ----------: | -----: | ----: | ------------: |
| Desktop |         869 |      1 | 0.12% |         63.23 |
| Mobile  |          85 |      2 | 2.35% |         55.86 |

## Top countries (28 days, by impressions)

USA (226), India (131), Philippines (72), Vietnam (59), Indonesia (44), Turkey (40), Germany (38),
UK (36, 1 click), Thailand (35), Bangladesh (34) — full list in
`~/.config/crawlpact-gsc/output/search-console/28d_countries.csv`. Low-volume country rows (single
clicks) are not evidence of meaningful traction in that market; not overinterpreted here.

## URL-form fragmentation (90 days) — the exact defect Phase 20 (2026-09-07) fixed

**16 distinct normalized-URL groups** currently show impressions split across a trailing-slash and
non-trailing-slash form of the same page — confirming, with real numbers, the defect diagnosed and
fixed on 2026-09-07 (permanent 301 canonicalization, one form only in the sitemap). The two largest:

| Normalized page                  | Total impressions |     Slash form | Non-slash form |
| -------------------------------- | ----------------: | -------------: | -------------: |
| `/tools/robots-txt-ai-validator` |               358 | 209 (pos 79.6) | 149 (pos 75.1) |
| `/crawlers/amazonbot`            |               246 | 232 (pos 65.8) |  14 (pos 55.2) |

12 more groups exist at smaller volume (`/crawlers/googlebot`, `/crawlers`, `/for/publishers`,
`/crawlers/amzn-searchbot`, `/crawlers/amzn-user`, `/crawlers/perplexitybot`, `/methodology`,
`/tools/llms-txt-validator`, `/about`, `/tools/ai-crawler-checker`,
`/tools/content-signals-checker`, `/guides/should-you-block-ccbot`, `/security`,
`/crawlers/oai-searchbot`) — full detail in
`~/.config/crawlpact-gsc/output/search-console/phase20-analysis.txt`.

**This is pre-fix data** (crawled before 2026-09-07's canonical fix was deployed — nothing has been
deployed yet as of this writing). Expected outcome once deployed and recrawled: these groups
consolidate into a single (slash-form) identity. See "Measurement checkpoints" in the completion
report for when to check back.

### Query × page competition (90 days)

22 queries currently show impressions split across multiple raw page URLs. All but two collapse to
a **single normalized page identity** once the two URL forms are merged (e.g., "robots.txt
validator": 111 impressions split 61/50 across the two `/tools/robots-txt-ai-validator` forms —
one real page, two measured identities). The two genuine exceptions (real cross-page competition,
not a canonical artifact): "amazonbot user agent" (split across `/crawlers/amazonbot/`,
`/crawlers/amzn-searchbot/`, `/crawlers/amzn-user/` — three distinct, legitimately different
pages) and "perplexitybot robots.txt user-agent documentation" (split across
`/crawlers/perplexity-user/` and `/crawlers/perplexitybot`). These are content/intent questions,
not technical defects — preserved as Phase 22 backlog, not touched here.

## Canonical mismatches (pre-existing bulk URL Inspection, 79 URLs, run before this session)

- Fully aligned (sitemap URL = user canonical = Google canonical): 57
- Sitemap URL ≠ user canonical: 20 — **all but 2 are the exact defect fixed 2026-09-07**: the old
  sitemap listed the bare form of a prerendered page while the page's own canonical tag (and
  Google) already preferred the trailing-slash form ("Page with redirect" coverage state on every
  one of these 18). Once deployed, the sitemap now lists the slash form directly, closing this.
- Sitemap URL ≠ Google canonical: 19 (same root cause/overlap with the above)
- User canonical ≠ Google canonical: **1** — `/contact` (see below)
- Incomplete canonical data: 2 — `/audit`, `/platforms` (see below)

### `/contact`: the one real canonical disagreement

|                                  | Value                            |
| -------------------------------- | -------------------------------- |
| Sitemap URL (at inspection time) | `https://crawlpact.com/contact`  |
| User-declared canonical          | `https://crawlpact.com/contact/` |
| Google-selected canonical        | `https://crawlpact.com/contact`  |
| Coverage state                   | Submitted and indexed            |

Unlike every other mismatch (which showed "Page with redirect" — i.e., Google correctly saw a
redirect and just hadn't updated its stored canonical yet), `/contact` shows **"Submitted and
indexed"** — meaning Google actually indexed the bare form as a real, separate, successfully-served
page at the time of the pre-fix crawl, contradicting the page's own declared canonical.

This is fully consistent with the pre-fix production behavior 2026-09-07 diagnosed and fixed:
before that fix, `/contact` (bare) was a prerendered page that Cloudflare's default asset handling
307-redirected to `/contact/` — a _temporary_ redirect. Google can and does sometimes retain its
own prior canonical decision across a temporary redirect rather than immediately adopting the
target as canonical (this is standard, documented Google behavior — permanent redirects are the
stronger signal). Now that `/contact` returns a real `301` (via `public/_redirects`) and the
sitemap lists only `/contact/`, this should resolve on the next recrawl. **Not independently
re-verified yet** (nothing has been deployed) — tracked as `PENDING_GOOGLE_REPROCESSING`, not a
remaining defect requiring further code change.

### Two guide pages with an apparently-reversed canonical (investigated, resolved as stale data — no code defect)

The inspection snapshot separately flagged `/guides/robots-txt-vs-meta-robots-vs-x-robots-tag` and
`/guides/rsl-or-content-signals-not-detected` as "Alternate page with proper canonical tag" with
both the user-declared and Google-selected canonical being the **non-slash** form — the opposite
direction from every other guide, and from the sitewide policy.

Investigated directly:

- **Live production today** (2026-09-08, `curl`): both pages' actual `<link rel="canonical">` tag
  is the trailing-slash form, matching every other guide page exactly (confirmed by diffing against
  a known-good guide, `/guides/should-you-block-ccbot/`).
- **Source code**: `apps/web/src/pages/guides/[slug].astro` sets
  `canonicalPath={`/guides/${guide.id}/`}` unconditionally — there is no per-guide override
  mechanism, so these two pages could never have generated a different canonical from any other
  guide.
- **Git history**: both guides' content files have exactly one commit each (the repository's
  initial commit) — never edited since creation.

**Conclusion: this is stale Google-side data from an earlier crawl** (`last_crawl_time` on both
rows: 2026-07-31, five weeks before this check), not a current or ever-real code defect. No fix was
needed or made. Recorded here so a future session doesn't rediscover the same inspection row and
mistake it for a live problem.

### `/audit` and `/platforms`: "Discovered — currently not indexed"

Both are `NEUTRAL` verdict, `Discovered - currently not indexed` — Google knows the URLs exist but
has not yet indexed them. Per instruction, **not removed, not noindexed, evaluated against role**:

- `/audit` — the public audit-start landing page (distinct from `/audit/[auditId]`, the private,
  correctly-noindexed report page). Heavily linked internally: the site header nav, the homepage
  pricing section, `/about`, `/platforms` (hub and per-platform pages), every `/tools/*` page,
  `/crawlers/[slug]`, `/for/[slug]`, and `/guides/[slug]` all link to it. Not orphaned, not thin by
  any internal-linking measure.
- `/platforms` — the platform-guides hub/index page. Linked from the homepage's audience section.
  Less heavily linked than `/audit`, but a legitimate, necessary index page (the same role
  `/crawlers` and `/guides` play, both of which _are_ indexed).

Both are exactly the kind of page (functional/navigational, not a standalone content article) that
can legitimately take longer for Google to decide is worth indexing, especially on a young,
low-authority site — "not yet indexed" is not itself evidence of a technical defect. No content or
indexability change made. If either is still `Discovered - not indexed` well after the canonical
fix ships and recrawl catches up, that becomes a legitimate Phase 22 content-quality question, not
a Phase 20 technical one.

## What this confirms about the 2026-09-07 fix

Every fragmentation group and every "sitemap ≠ canonical" mismatch found in this real data matches
the exact mechanism 2026-09-07's `CANONICAL_URL_CONTRACT.md` diagnosed and fixed. No new
canonical-policy defect was found that contradicts or requires revising that decision. The two
genuinely new findings from this real data were (1) the `/contact` state-detail above (informative,
not a required code change) and (2) a real, separate defect this data helped surface: **internal
links across the site pointing to non-canonical URLs** — see `INTERNAL_LINK_CANONICALIZATION.md`.
