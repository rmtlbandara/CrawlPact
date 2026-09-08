# Phase 22 Generative AI Search Visibility

## Report availability: `GENERATIVE_AI_REPORT_NOT_EXPOSED_TO_CURRENT_API_TOOLING`

Investigated directly against the live Search Console API's own discovery document (not assumed
from memory or documentation age). The `searchanalytics.query` request body's `type` field enum,
read live from the API client's discovery schema on 2026-09-08, is exactly:

```
WEB, IMAGE, VIDEO, NEWS, DISCOVER, GOOGLE_NEWS
```

No `AI_OVERVIEW`, `AI_MODE`, or equivalent generative-AI-specific search type exists in this
enum. This is direct, primary evidence (the API's own live schema) that the dedicated Generative
AI Performance report Google rolled out for the Search Console UI (per the phase prompt's Section
65, effective 2026-08-31) is not retrievable through the existing read-only Search Analytics API
this tooling uses — not a guess, not an assumption that it "probably isn't supported yet."

A `searchAppearance` dimension query was also attempted for both the 28-day and 90-day windows
(2026-08-10→2026-09-06 and 2026-06-09→2026-09-06) — both returned **0 rows**. This does not mean
CrawlPact has zero generative-AI visibility; it means no row in this property's data carries a
`searchAppearance` category value the API currently reports, which is consistent with (but not
proof of) a young, low-traffic site not yet appearing in any categorized rich result or AI
surface. No visibility claim, positive or negative, is made from this alone.

## What was not done

- No attempt to reverse-engineer an undocumented Google endpoint or scrape the authenticated
  Search Console UI for the dedicated report — explicitly forbidden by the phase prompt (Section 66) and not attempted.
- No official exported CSV was supplied by the owner this session, so no dedicated-report data
  exists to analyze at all this phase.
- No fabricated metric of any kind (AI Mode clicks, AI Overview CTR, citation position, "LLM
  ranking score") appears anywhere in this package, per the phase prompt's explicit Section 67
  prohibition.

## Search generative AI inclusion control (Section 68)

The Search Console UI's separate "Search generative AI" inclusion/exclusion control was not
read this phase — the read-only Search Analytics/URL Inspection API surface this tooling uses
does not expose site-level UI preference settings, and this session's OAuth scope
(`webmasters.readonly`) does not extend to a broader settings API even if one existed. Recorded
honestly as `UNVERIFIED`, per the phase prompt's own instruction ("If not: record: UNVERIFIED. Do
not guess."). No change was made to this setting — changing it requires explicit owner
authorization, which was not sought or given this phase.

## `llms.txt` and Google ranking

Per the phase prompt's Section 64, CrawlPact's own `llms.txt`/`llms-full.txt` (if either exists)
was not created or modified this phase for the purpose of improving Google ranking or AI Overview
visibility, and no claim that it does so appears anywhere in this package or in any content
changed this phase.
