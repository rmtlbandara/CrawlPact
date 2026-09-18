---
Document owner: Engineering owner
Status: current-authoritative (Phase 2, §6 — internal linking / content architecture)
---

# Internal Linking Audit — 2026-09-18

Real gaps checked this pass, using the actual content-collection data and the actual page
templates (not assumed from the directive's description of what "should" exist).

## Structured data (§7 "search appearance") — checked, no real gap found

`BaseLayout.astro` builds a sitewide JSON-LD `@graph` (Organization + WebSite always; Article and
BreadcrumbList conditionally on page props; per-page `extraJsonLd` for anything else, e.g.
`FAQPage` on the homepage, `HowTo` on relevant guides). Verified every dynamic content template
(`crawlers/[slug]`, `guides/[slug]`, `platforms/[slug]`, `for/[slug]`, `research/[slug]`) actually
passes `ogType="article"` and real `breadcrumbs`. This is already a mature implementation — no
Phase 2 work needed here.

## Crawler ↔ guide cross-linking — real gap found and fixed

`crawlers/[slug].astro` shows a "Related guides" section driven by each guide's
`relatedCrawlerSlugs` frontmatter field (an explicit, source-of-truth link, not fragile keyword
matching against guide body text — by design, per the schema's own comment). Checked all 21
guides: **13 of 21 (62%) had no `relatedCrawlerSlugs` at all**, meaning every crawler detail page
they were actually relevant to showed nothing in "Related guides."

Read each of the 13 guides' actual body content to determine which, if any, genuinely warranted a
link (not a name-matching heuristic — an actual read):

- **2 guides substantively discuss specific named crawlers** and were missing the link purely by
  omission:
  - `blocking-ai-training-while-staying-visible-in-ai-search.md` — walks through
    per-operator training-vs-search distinctions for Amazon, Apple, Google, Meta, OpenAI, and
    Anthropic by name. Added `relatedCrawlerSlugs` for all 12 crawlers it actually names:
    `amazonbot`, `applebot-extended`, `chatgpt-user`, `claude-searchbot`, `claude-user`,
    `claudebot`, `gptbot`, `google-extended`, `googlebot`, `meta-externalagent`,
    `meta-webindexer`, `oai-searchbot`.
  - `how-to-block-only-ai-training-crawlers.md` — the step-by-step companion to the guide above,
    listing the same training-purpose tokens as concrete robots.txt examples. Added the 5 it
    actually shows: `gptbot`, `claudebot`, `google-extended`, `applebot-extended`,
    `meta-externalagent`.
- **11 guides were correctly left unlinked.** Two (`robots-txt-syntax-basics.md`,
  `robots-txt-rule-not-blocking-a-crawler.md`) mention `GPTBot` exactly once each, as a generic
  illustrative example, not as substantive discussion of that crawler specifically — adding a
  crawler association on that basis would be a fabricated link, not a real one. The other 9
  (RSL/llms.txt/Content-Signal how-tos, the three-mechanism decision guides, and the
  troubleshooting guides) are genuinely protocol-level or product-troubleshooting content with no
  crawler-specific subject matter at all. Leaving these unlinked is the correct, evidence-based
  outcome, not an unclaimed gap.

Verified fix: `pnpm content:validate` passes (schema-valid frontmatter, `4 verticals, 5 platforms
checked`); `gptbot.md`'s crawler page now resolves 3 related guides instead of 1
(`gptbot-vs-oai-searchbot-vs-chatgpt-user`, `blocking-ai-training-while-staying-visible-in-ai-
search`, `how-to-block-only-ai-training-crawlers`) via the real `getCollection("guides")` filter
logic in `crawlers/[slug].astro`.

## Not yet checked this pass

- Guide → crawler forward links (whether guide body prose actually hyperlinks to
  `/crawlers/[slug]/` inline, vs. only the sidebar "Related crawlers" block).
- Research/observatory cross-linking — moot until the first research publication exists (see
  `RESEARCH_PUBLICATION_EVIDENCE.md`).
- Platform (`/platforms/`) and vertical (`/for/`) pages' outbound links to guides/crawlers —
  not audited this pass; flagging as open, not claiming it's clean.
