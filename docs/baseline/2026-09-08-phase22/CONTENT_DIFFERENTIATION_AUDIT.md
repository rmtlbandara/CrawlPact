# Phase 22 Content Differentiation Audit

The phase prompt's own test (Section 35): "What information would disappear if this crawler name
were replaced with another? If the answer is 'almost nothing,' the page is insufficiently
differentiated."

Applied to every crawler page materially changed this phase:

| Page                                                | What disappears if the crawler name were swapped                                                                                                                                                                                                           |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `amazonbot.md`                                      | The specific "mixed use, may train Amazon AI models" classification, the exact `Amazonbot/0.1` token, and the specific cross-references to Amzn-SearchBot/Amzn-User's differing robots.txt behaviour — all Amazon-specific, sourced from Amazon's own page |
| `amzn-searchbot.md`                                 | The specific fallback-to-other-search-bots robots.txt behaviour (a fact not documented for any other operator's crawler on this site), the "not used for AI training" contrast with Amazonbot specifically                                                 |
| `amzn-user.md`                                      | The specific "may not follow all robots.txt directives" limitation — a fact that, notably, is _shared in kind_ with Perplexity-User but expressed with Amazon's own specific wording and consequence                                                       |
| `perplexitybot.md`                                  | The specific "respects robots.txt, recommends allowing it" fact, contrasted with Perplexity-User specifically                                                                                                                                              |
| `perplexity-user.md`                                | The specific "generally ignores robots.txt" quote and its Perplexity-specific rationale (user-initiated fetch)                                                                                                                                             |
| `amazonbot-vs-amzn-searchbot-vs-amzn-user.md` (new) | Every fact in it is Amazon-specific (three real tokens, real purposes, real compliance differences) — none of it would read coherently with any other operator's name substituted                                                                          |

None of the six pages would read as "almost nothing changes" with the crawler name swapped — each
carries at least one fact (usually a robots.txt-compliance behaviour) that is specific to that
exact operator/token and was verified against that operator's own current documentation this
phase, not inherited from a shared template with the name changed.

## Similarity review (Section 58)

A structural similarity review was performed by inspection (not an automated similarity-scoring
tool) across the three Amazon crawler pages and the two Perplexity crawler pages, since these are
exactly the "same template, different crawler" pages most at risk of insufficient differentiation:

- **Shared structure** (acceptable, matches every other crawler page on the site): frontmatter
  fields, an opening factual paragraph, a "Site-owner controls" section, a "Related crawlers"
  section.
- **Non-shared content** (the actual differentiator): the purpose classification, the exact
  robots.txt-compliance behaviour, and — after this phase's changes — a distinct "worth knowing"
  callout section unique to each of the four pages that received one (Amzn-SearchBot,
  Amzn-User, PerplexityBot, Perplexity-User all now have operator/token-specific compliance facts
  that did not exist, or were incorrect, before this phase).

No page was found to be a near-duplicate of another after these changes; if anything, the changes
increased differentiation (added facts that are true of one token and explicitly false of its
sibling token) rather than decreasing it.
