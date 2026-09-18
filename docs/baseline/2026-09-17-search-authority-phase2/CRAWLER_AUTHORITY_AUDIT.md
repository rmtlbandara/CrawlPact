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
operator's sibling crawlers, the way every *other* page in that family does?

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
a genuine content *change* should do so is a registry-governance policy question, not a bug in
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

## Not yet checked this pass

- `googleother.md`, `google-cloudvertexbot.md`, `perplexitybot.md`, `perplexity-user.md` — not
  read in full this pass (their line counts and purpose values didn't flag them as outliers);
  genuinely open, not claimed clean.
- Operator-level authority pages (§17 of the directive) — separate workstream, not started.
