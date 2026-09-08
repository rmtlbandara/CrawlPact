# Phase 22 SEO Opportunity Register

Classified per the phase prompt's own triage categories (Section 25) — no single composite "SEO
score" used anywhere.

## A. Near-win (position ~8-20, meaningful impressions, strong intent fit)

| Page                                     | 90d impr | Avg pos | Action taken                                                                                                                                                                                                       |
| ---------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/platforms/vercel/`                     | 43       | 17.6    | Re-verified against current Vercel/Next.js official docs; confirmed accurate; no content change (Section 29: don't rewrite what's already strong); `platformDocsVerifiedDate` updated to reflect the real re-check |
| `/guides/metas-four-crawlers-explained/` | 19       | 16.9    | Reviewed; query composition almost entirely suppressed by GSC (can't identify what's actually driving this position); content already strong; no change made rather than guessing at a rewrite                     |
| `/methodology/`                          | 14       | 20.4    | Borderline near-win/emerging; evergreen content per `CONTENT_FRESHNESS_AND_REVIEW_POLICY.md`; no phase-prompt mandate; not reviewed in depth this pass                                                             |

## B. Emerging (position ~20-50, growing impressions, strong user value)

| Page                        | 90d impr | Avg pos | Action taken                                                                                      |
| --------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------- |
| `/crawlers/amzn-searchbot/` | 33       | 30.7    | Strengthened (Amazon cluster review) — added robots.txt fallback-behaviour fact, comparison guide |
| `/crawlers/amzn-user/`      | 19       | 22.9    | Strengthened — **factual correction**: robots.txt non-compliance fact added                       |

## C. Deep visibility (high impressions, very low position)

| Page                                                                                              | 90d impr   | Avg pos                                                      | Assessment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/tools/robots-txt-ai-validator/`                                                                 | 358        | 77.7                                                         | **CONTENT_READY–AUTHORITY_LIMITED.** Query cluster is 100% generic "robots.txt validator/checker" traffic (verified via `query×page` export — zero queries mention AI or a specific bot). The page's own first paragraph already covers general syntax validation, not just AI-specific groups, so this is not a query-to-page mismatch. Position (63-99 across every query) reflects competing against long-established, high-authority generic robots.txt tools — a young-site authority problem, not a content problem. No content or metadata change made. Handed to Phase 23 for authority/distribution work. |
| `/crawlers/amazonbot/`                                                                            | 247        | 65.2                                                         | Strengthened for differentiation (Amazon cluster), but the deep position itself is not attributed to a content defect — no evidence found that content quality, not authority, is the limiting factor here either                                                                                                                                                                                                                                                                                                                                                                                                  |
| `/guides/robots-txt-vs-meta-robots-vs-x-robots-tag/`                                              | 88         | 78.8                                                         | Reviewed at the matrix level only; no phase-prompt mandate, no anomalous evidence found; `NO_ACTION`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/crawlers/googlebot/`, `/crawlers/gptbot/`, `/guides/` hub, `/crawlers/` hub, `/for/publishers/` | 39-64 each | `NO_ACTION` — no phase-prompt mandate, no anomalous evidence |

## D. CTR opportunity

**None found this phase.** Per the phase prompt's Section 14, CTR is only diagnostic when
impressions are meaningful _and_ ranking visibility is sufficient. Every page in this dataset with
meaningful impressions sits at position 60+ (deep visibility, category C above) or already
converts well at a strong position (homepage: 3 clicks at position ~1.6-1.9 — already working). No
page showed the pattern this category requires (good position, meaningful impressions, 0% CTR).

## E. Intent conflict

| Cluster                                     | Resolution                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Amazon (Amazonbot/Amzn-SearchBot/Amzn-User) | Resolved — differentiation + new comparison guide, no merge (see `SEARCH_INTENT_OWNERSHIP.md`) |
| Perplexity (PerplexityBot/Perplexity-User)  | Reviewed — evidence too thin to call a real conflict; real factual correction made instead     |

## F. Indexing/quality review

| Page          | State                      | Action                                                                                                                                                                                     |
| ------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/platforms/` | "URL is unknown to Google" | Verified technically healthy (200, canonical, sitemap, well-linked). `MONITOR` — not a content problem per Section 44's own guidance ("do not conclude that 'more words' is the solution") |
| `/audit/`     | "URL is unknown to Google" | Same verification, same disposition, per Section 45                                                                                                                                        |

See `INDEXING_FOLLOW_UP.md` for the full evidence.

## Pages not reviewed this phase (explicitly, not silently)

The ~65 remaining crawler/guide/platform/vertical pages not named above received no individual
review this phase — no phase-prompt mandate applied to them, and none showed anomalous GSC
evidence in the canonical-normalized matrix. This is consistent with the phase prompt's own
Section 27 ("select the smallest set of pages that represents the strongest evidence... five
strong improvements are better than fifty generic rewrites") — not an oversight.
