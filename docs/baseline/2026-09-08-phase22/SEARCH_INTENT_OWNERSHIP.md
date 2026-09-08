# Phase 22 Search Intent Ownership

Compares planned intent (`docs/seo/SEARCH_INTENT_AND_PAGE_MAP.md`, written before this evidence
existed) against actual GSC-observed intent, for the two clusters this phase reviewed in depth.
`SEARCH_INTENT_AND_PAGE_MAP.md` covers verticals/platforms only and never claimed to plan
individual crawler-token ownership, so there is no prior plan to reconcile for the crawler
directory specifically — this document is additive, not a correction of that map.

## Amazon cluster: Amazonbot / Amzn-SearchBot / Amzn-User

|                                                  |                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary owner                                    | `/crawlers/amazonbot/` (broad/ambiguous "amazon crawler" queries)                                                                                                                                                                                                                                                    |
| Secondary/supporting                             | `/crawlers/amzn-searchbot/` (already owns its own specific-token query at position 5-20), `/crawlers/amzn-user/`                                                                                                                                                                                                     |
| Intent                                           | REFERENCE/DEFINITIONAL + DIAGNOSTIC ("what is this crawler / what is my log showing")                                                                                                                                                                                                                                |
| User task                                        | Identify which Amazon crawler token is which, and how each one's `robots.txt` behaviour actually differs                                                                                                                                                                                                             |
| GSC evidence                                     | 247 90d impressions on amazonbot alone; genuine 3-way split on the literal query "amazonbot user agent" (2 impressions each) — see `GSC_QUERY_CLUSTER_ANALYSIS.md`                                                                                                                                                   |
| Content role                                     | Amazonbot = flagship/broadest reference page; Amzn-SearchBot/Amzn-User = specific-token reference pages; new `/guides/amazonbot-vs-amzn-searchbot-vs-amzn-user/` = decision/comparison page for the ambiguous query and the robots.txt-compliance decision specifically                                              |
| Internal-link relationship                       | All three crawler pages now cross-link to the new comparison guide (added this phase); the comparison guide links back to all three                                                                                                                                                                                  |
| Queries this page should own                     | Amazonbot: "amazonbot", "amazon [bot/crawler/robots.txt]" (generic Amazon-crawler queries). Amzn-SearchBot: "amzn-searchbot" (exact token — already owns this well). Amzn-User: "amzn-user" (exact token)                                                                                                            |
| Queries this page should NOT deliberately target | Amazonbot should not attempt to own "amzn-searchbot"/"amzn-user" exact-token queries — those pages already serve them better                                                                                                                                                                                         |
| Cannibalization risk                             | Low — the one ambiguous query ("amazonbot user agent") genuinely has no single correct answer; all three pages appearing is legitimate per the phase prompt's own Section 22 ("multiple pages appearing for one query does NOT automatically mean cannibalization... may be legitimate when the query is ambiguous") |

**Disposition**: no merge, no ownership reassignment. Differentiation strengthened with real,
source-verified facts (robots.txt compliance differs materially across the three tokens — a fact
none of the three pages stated before this phase) and a new comparison guide mirroring the
existing, working `claudebot-vs-claude-user-vs-claude-searchbot.md` pattern.

## Perplexity cluster: PerplexityBot / Perplexity-User

|                            |                                                                                                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary owner              | `/crawlers/perplexitybot/` (search/indexing intent)                                                                                                                                                  |
| Secondary/supporting       | `/crawlers/perplexity-user/` (user-triggered intent)                                                                                                                                                 |
| Intent                     | REFERENCE/DEFINITIONAL                                                                                                                                                                               |
| User task                  | Understand the difference, and — critically — which one a `robots.txt` rule actually controls                                                                                                        |
| GSC evidence               | Thin (9 total impressions across 7 distinct long-tail queries) — see `GSC_QUERY_CLUSTER_ANALYSIS.md`; some weak evidence Google is unsure which page best answers a generic "...documentation" query |
| Content role               | Both are reference pages; `perplexitybot-vs-perplexity-user.md` (pre-existing) is the decision/comparison page                                                                                       |
| Internal-link relationship | Unchanged this phase — the comparison guide and both crawler pages already cross-linked correctly                                                                                                    |
| Cannibalization risk       | Low — evidence is too thin to call this a real conflict; the ambiguity (if any) is in query phrasing, not in the site's own content structure                                                        |

**Disposition**: no merge, no ownership reassignment, no new page. **A real factual correction**
was found and fixed instead: `perplexity-user.md` previously stated "Standard `robots.txt`
disallow rules apply," which contradicts Perplexity's own current documentation ("since a user
requested the fetch, this fetcher generally ignores robots.txt rules"). This is a more
operationally important finding than the query-cluster ambiguity itself — a site owner who wrote a
`Disallow: Perplexity-User` rule believing it would work was being given inaccurate information.
Fixed in `perplexity-user.md`, `perplexitybot.md` (made its own robots.txt-respecting behaviour
explicit, for contrast), and the existing comparison guide.

## Hub/detail, tool/guide, homepage/audit boundaries

Reviewed for evidence of conflict; none found requiring action:

- **Hub/detail** (`/crawlers/`, `/guides/`, `/platforms/`): each hub's own GSC impressions (45, 51,
  and n/a respectively) are for hub-level browsing queries, not competing with any individual
  detail page's queries.
- **Tool/guide overlap**: `/tools/robots-txt-ai-validator/` and
  `/guides/robots-txt-syntax-basics/`/`/guides/robots-txt-vs-meta-robots-vs-x-robots-tag/` serve
  different intents (a live validator vs. explanatory guides) and don't compete for the same query
  cluster in the data.
- **Homepage/audit boundary**: the homepage (22 90d impressions, position 1.6, 3 clicks) and
  `/audit/` (0 impressions, not yet indexed — see `INDEXING_FOLLOW_UP.md`) show no overlap at all
  in current evidence; nothing to resolve.
- **Platform/guide overlap**: `/platforms/vercel/` already links to
  `/guides/robots-txt-vs-meta-robots-vs-x-robots-tag/` and `/guides/policy-health-score-dropped-between-scans/`
  per its existing `relatedGuideSlugs` — no gap found.
