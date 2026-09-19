---
Document owner: Engineering owner
Status: current-authoritative (Phase 2, §16 — crawler-page authority audit)
---

# Crawler-Page Authority Audit — 2026-09-18

A real, per-page review of all 22 published crawler content pages
(`apps/web/src/content/crawlers/*.md`), checking title/H1, description, user-agent, operator,
purpose, official source, lifecycle, disambiguation from sibling crawlers, related-content links,
and verification date — per Phase 2 §16.

## Method

Pulled per-file stats (line count, `lastVerified`, `purpose`, summary length) across all 22 pages,
then read the full body of every page under 30 lines (the outlier band) plus one page per
multi-crawler operator family (Amazon, Meta, OpenAI, Google, Anthropic) to check for a consistent
structural pattern: does each crawler page reciprocally disambiguate itself from its own
operator's sibling crawlers, the way every _other_ page in that family does?

## Real gap found and fixed: ClaudeBot page

`claudebot.md` was the single thinnest page in the entire directory (19 lines, one body section)
and, uniquely among training-purpose crawler pages, never disambiguated itself from its own
operator's sibling crawlers. This was a real asymmetry, not a stylistic preference — both
`claude-user.md` ("Why this is different from ClaudeBot") and `claude-searchbot.md` ("Why the
distinction matters") explicitly point back at ClaudeBot's training purpose, but ClaudeBot itself
never returned the favor. Every other training-purpose crawler page in the registry does this
reciprocal disambiguation: `gptbot.md` ("What blocking GPTBot does" — names `OAI-SearchBot` and
`ChatGPT-User`), `google-extended.md` ("Why this one is easy to get wrong" — names `Googlebot`),
`meta-externalagent.md` ("Distinguishing from Meta's other crawlers" — names all three siblings),
`applebot-extended.md` (names base `Applebot`).

**Fixed**: added a "What blocking ClaudeBot does" section to `claudebot.md`, naming `Claude-User`
and `Claude-SearchBot` by their actual documented purposes (user-triggered retrieval, search
relevance) — matching the established pattern's wording style, not copied verbatim from any other
page. Verified: `pnpm content:validate` and `pnpm exec prettier --check` both pass.

## Checked, no gap found

- **Amazon family** (`amazonbot.md`, `amzn-searchbot.md`, `amzn-user.md`): all three fully
  cross-reference each other and link to the dedicated comparison guide
  (`/guides/amazonbot-vs-amzn-searchbot-vs-amzn-user/`). No action needed.
- **Meta family** (`meta-externalagent.md`, `meta-externalfetcher.md`, `meta-externalads.md`,
  `meta-webindexer.md`): each names all three siblings by purpose. No action needed.
- **OpenAI family** (`gptbot.md`, `oai-searchbot.md`, `chatgpt-user.md`, `oai-adsbot.md`): checked
  `gptbot.md` and `oai-searchbot.md` in full — both disambiguate correctly.
- **Google family** (`googlebot.md`, `google-extended.md`, `google-cloudvertexbot.md`):
  `googlebot.md` and `google-extended.md` both explicitly name each other.

## Verification-date observation (not a defect, flagged for the record)

`ccbot.md`, `applebot-extended.md`, and `meta-externalagent.md` carry the oldest `lastVerified`
dates in the directory (`2026-07-01`). Cross-checked directly against the live D1 `crawlers` table
(`crw_ccbot`, `crw_applebot_extended`, `crw_meta_external_agent`) — all three match exactly
(`last_verified_at: "2026-07-01"`), so there is **no drift** between the public content pages and
the governed registry data; this is not a sync bug.

Worth noting for process, not fixing here: Phase 1's `CRAWLER_REGISTRY_FRESHNESS_AUDIT.md`
(2026-09-17) re-confirmed CCBot and Meta-ExternalAgent against live vendor documentation and found
"no change," but did not bump `last_verified_at` for either — only the newly-added `crw_applebot`
row got a fresh date. Whether a "re-confirmed, no change" event should advance
`last_verified_at` (so the 180-day review-due clock reflects actual confirmation recency) or only
a genuine content _change_ should do so is a registry-governance policy question, not a bug in
this pass's data. Both are still well within the 180-day review-due threshold (79 days old as of
today). Flagging as a process question for whoever owns `docs/registry/
SOURCE_VERIFICATION_POLICY.md`, not changing it via a direct D1 write.

## Structured data, thin-page, and duplication checks

- Structured data: already covered in `INTERNAL_LINKING_AUDIT.md` — mature, no gap.
- Thin-page check: page length correlates with genuine content complexity (single-purpose
  crawlers like `google-cloudvertexbot.md` are legitimately shorter than multi-sibling families),
  not neglect — confirmed by reading the outlier band rather than assuming length implies quality.
- Duplicated wording: none found — each page's disambiguation language is specific to that
  crawler's actual documented behavior (e.g. `Amzn-User`'s "may not follow all robots.txt
  directives" caveat, `Meta-WebIndexer`'s lowercase-token note), not templated boilerplate.

## Follow-up read (2026-09-19) — remaining four pages, no gap found

`googleother.md`, `google-cloudvertexbot.md`, `perplexitybot.md`, and `perplexity-user.md` were
initially skipped (their size and purpose didn't flag them as outliers) and were read in full on
2026-09-19. All four hold the same standard as the rest of the directory: each states its
operator, purpose and the reasoning behind that category, cites Google's/Perplexity's own wording
rather than paraphrase, and explains what disallowing it does and does not affect relative to its
sibling tokens. `googleother.md`'s deliberately unspecific "unknown" hedging matches Google's own
documentation (which does not name a purpose) and is the correct handling under FR-REG-005, not a
thin-page defect. `perplexity-user.md` correctly surfaces Perplexity's documented "generally
ignores robots.txt" behavior. No changes made from that read. The remaining three
(`ccbot.md`, `chatgpt-user.md`, `oai-adsbot.md`) were read the same day. This closes the earlier
"not yet checked" item — all 22 crawler pages have now been read in full.

## robots.txt-semantics verification against primary sources (2026-09-19) — 3 defects fixed

Reading `chatgpt-user.md` surfaced an inconsistency: it stated "Standard `robots.txt` disallow
rules apply," while sibling user-triggered pages (`Amzn-User`, `Perplexity-User`) carry an explicit
"may not be honoured" caveat. Phase 1's freshness audit and Phase 15's re-verification confirmed
each crawler's **token and purpose** against vendor docs, but neither checked **what the vendor
says about robots.txt compliance** — so this whole class of claim had never been verified. Every
page that makes such a claim for a user-triggered/agent/ads crawler was checked against the
vendor's own page (fetched 2026-09-19):

| Crawler                        | Vendor statement (verbatim, per fetch)                                                                          | Our page said                                   | Result                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| `ChatGPT-User`                 | "Because these actions are initiated by a user, robots.txt rules may not apply."                                | "Standard robots.txt disallow rules apply"      | **Wrong — fixed**                        |
| `Meta-ExternalFetcher`         | "may bypass robots.txt because it performs fetches that were requested by the user."                            | "Disallowing … prevents" the fetch              | **Wrong — fixed** (direct contradiction) |
| `OAI-AdsBot`                   | robots.txt not mentioned in its section; page-level guidance names only OAI-SearchBot and GPTBot                | "supporting standard robots.txt disallow rules" | **Unsupported — fixed**                  |
| `Claude-User`                  | Not stated per-bot; Anthropic states generally that its bots honor "industry standard directives in robots.txt" | "Standard robots.txt disallow rules apply"      | Supported — no change                    |
| `Amzn-User`, `Perplexity-User` | Pages already quote the vendor's own caveat (vendor pages not re-fetched today; last confirmed in Phase 1)      | matches                                         | No change                                |

Fixes: `chatgpt-user.md`, `meta-externalfetcher.md`, `oai-adsbot.md` now quote the vendor and add a
"robots.txt limitation worth knowing" section in the same shape as the Amzn-User/Perplexity-User
pages; the two guides that discuss these tokens (`gptbot-vs-oai-searchbot-vs-chatgpt-user`,
`metas-four-crawlers-explained`) gained a one-sentence caveat. Each page states the date the
wording was checked. **`lastVerified` was deliberately not bumped**: it must stay in sync with the
governed registry's `last_verified_at`, which cannot be changed outside the admin workflow, and
this was a wording check against an already-verified source, not a new registry verification.

Method caveat, stated plainly: vendor text was retrieved through a summarising fetch tool, not a
raw HTTP capture. The `ChatGPT-User` quote was reproduced identically across two independent
fetches; the `Meta-ExternalFetcher` quote was one fetch. The owner should treat the exact
punctuation as reliable to the sentence, not guaranteed to the character.

Residual, not changed: Meta's page states no robots.txt behaviour for `Meta-ExternalAgent`,
`Meta-WebIndexer` or `Meta-ExternalAds`, and Anthropic's states none per-bot for `Claude-SearchBot`;
our pages for those describe a `Disallow` as effective, which is the conventional default but is
not explicitly confirmed by the vendor page. Flagged rather than hedged across the board.

**Open product question for the owner (not a content defect):** the registry seed carries no
robots-compliance data and no product code keys off it, so scan result screens and the AI crawler
checker show `Blocked`/`Allowed` for `ChatGPT-User`, `Meta-ExternalFetcher`, `Amzn-User` and
`Perplexity-User` without a per-crawler "vendor says this may ignore robots.txt" caveat — only the
public crawler pages and `/limitations` say so. Whether results should surface that is a product
decision left for the owner.

Operator-level authority pages were evaluated separately and deferred — see
`OPERATOR_AUTHORITY_DECISION.md`.
