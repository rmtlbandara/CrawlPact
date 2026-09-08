# Phase 22 Query Cluster Analysis

Built from the 90-day `query×page` export, canonical-normalized. Clusters below are the ones with
enough named-query evidence to analyze meaningfully — most of the site's query volume is
individually-suppressed by GSC's privacy/truncation rules (see `GSC_BASELINE.md`), so this is a
partial picture by construction, not a complete map of every query CrawlPact appears for.

## Cluster: generic robots.txt validation

- **Raw queries** (36 distinct rows, 90d): "robots.txt validator" (61+50=111 impr across two
  case/variant rows), "robot.txt validator" (38+1), "robots txt validator" (36+24), "robot txt
  validator" (20), "robots txt checker" (14+2), "robots.txt checker" (4+1), "robots txt analyzer"
  (9+5), "check for robots.txt" (16), "checking robots txt" (9+1), "check for robots txt" (7), and
  ~15 more single/low-impression variants — all landing on `/tools/robots-txt-ai-validator/`.
- **Clicks**: 0 across every row. **Position**: 63-99 across every row (deep visibility).
- **Intent**: IMPLEMENTATION / DIAGNOSTIC — "does my robots.txt file work / is it valid."
- **Current owner**: `/tools/robots-txt-ai-validator/`. **Intent conflict**: none — no other
  CrawlPact page competes for this cluster.
- **Assessment**: Not a query-to-page mismatch (the page genuinely validates general robots.txt
  syntax, not just AI-specific groups — see its first paragraph). Not a title/snippet problem
  (Section 14 — 0% CTR at position 70-95 is expected, not diagnostic). This is a generic,
  extremely competitive query space (`robots.txt validator` alone has many long-established,
  high-authority competitors); CrawlPact's young-site authority, not its content, is the limiting
  factor. **Classified CONTENT_READY–AUTHORITY_LIMITED, handed to Phase 23.**

## Cluster: Amazonbot / amazon crawler (ambiguous)

- **Raw queries**: "amazonbot" (9, pos 43.1, → amazonbot), "amazonbot user agent" (2 → amazonbot
  pos 35.5, 2 → amzn-searchbot pos 62.0, 2 → amzn-user pos 55.5 — a genuine 3-way split on the
  identical query string), "amazon bot" (1+4 → amazonbot), "amazon robots txt" (4 → amazonbot),
  "amazon web crawler" (3 → amazonbot), "amazonbot/0.1" (3 → amazonbot, pos 18.3 — best position
  in the cluster), "amazonbot ip range" (2 → amazonbot), plus several single-impression variants.
- **Intent**: mostly REFERENCE/DEFINITIONAL ("what is this crawler") and DIAGNOSTIC
  ("amazonbot user agent" — likely someone reading their own server logs and trying to identify a
  requester).
- **Genuine intent conflict found**: "amazonbot user agent" — the literal ambiguous query — really
  does surface all three Amazon crawler pages, because a log-reading site owner typing that exact
  phrase could plausibly mean any of the three tokens. This is not false cannibalization from
  historical URL fragmentation (Phase 20 already normalized that); it is Amazon's own three-token
  design being genuinely ambiguous to search the same way "claudebot user agent" or "perplexitybot
  user agent" would be for their respective operators.
- **Resolution**: see `SEARCH_INTENT_OWNERSHIP.md`. `/crawlers/amazonbot/` remains primary owner of
  the broad/ambiguous query (best position of the three, and "Amazonbot" is the literal string in
  the query); `/crawlers/amzn-searchbot/` already owns its own specific-token query excellently
  (pos 5.0 for the exact string "amzn-searchbot"); the fix was differentiation content and a new
  comparison guide, not merging or reassigning ownership.

## Cluster: Perplexity crawler tokens

- **Raw queries**: "perplexitybot" (1, pos 48 → perplexitybot), "perplexity bot user agent" (1 →
  perplexitybot, pos 76), "perplexitybot robots.txt documentation" (1 → perplexitybot, pos 77),
  "perplexitybot robots.txt user-agent documentation" (1 → perplexitybot pos 80, 1 →
  perplexity-user pos 70), "perplexitybot crawler user agent documentation robots.txt" (2 →
  perplexity-user, pos 67.5), "perplexitybot user agent documentation robots.txt" (1 →
  perplexity-user, pos 66), "perplexitybot user agent robots.txt documentation" (2 →
  perplexity-user, pos 61).
- **Intent**: REFERENCE/DEFINITIONAL, all long-tail documentation-lookup phrasing.
- **Assessment**: Longer, more verbose query phrasings landed disproportionately on
  `/crawlers/perplexity-user/` rather than `/crawlers/perplexitybot/` even when the query is about
  "documentation" generically rather than the user-triggered fetcher specifically — weak evidence
  (1-2 impressions per row) but directionally consistent with Google being unsure which page best
  answers a generic "perplexitybot ... documentation" query. Evidence volume here (9 total
  impressions across 7 distinct query strings) is too thin to justify a structural change; the
  differentiation content already exists (`perplexitybot-vs-perplexity-user.md`) and was
  strengthened with the actual operationally important fact (only one of the two respects
  `robots.txt`) rather than restructured.

## Clusters not analyzable this phase

Every other page in `GSC_CANONICAL_NORMALIZED_PAGE_MATRIX.md` with meaningful impressions
(`/tools/llms-txt-validator/`, `/methodology/`, `/for/publishers/`, hub pages, etc.) had either no
named queries in the 90-day export or too few to identify a real pattern — GSC's row suppression
means this is a data limitation, not evidence that "no one searches for these." No cluster
narrative is constructed for them.
