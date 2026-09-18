---
Document owner: Engineering owner
Status: current-authoritative (Phase 2, §29 — operator authority page decision)
---

# Operator Authority Page Decision — 2026-09-18

Phase 2 §29 asks whether dedicated operator-level pages (e.g. a single `/operators/openai/` page
covering all of OpenAI's crawlers together) would add genuine unique value, evaluated against a
real bar: all governed crawlers from the operator, purpose differences, official evidence,
opt-out semantics, crawler relationships, and implementation guidance — not just a list of names.

## Decision: not justified yet

The function a dedicated operator page would serve is **already covered by three existing,
working mechanisms together**, for every multi-crawler operator in the registry:

1. Each crawler's own page states its operator, purpose, official source, and (per the crawler
   authority audit in `CRAWLER_AUTHORITY_AUDIT.md`) reciprocally disambiguates itself from its
   operator siblings.
2. `crawlers/[slug].astro`'s automatic "Related crawlers" widget groups by same-operator (or
   same-purpose) with zero maintenance burden — it can't drift out of sync with the registry.
3. A dedicated comparison guide exists for every multi-crawler operator except Google:
   `amazonbot-vs-amzn-searchbot-vs-amzn-user` (Amazon, 3/3 crawlers), `metas-four-crawlers-
explained` (Meta, all 4), `claudebot-vs-claude-user-vs-claude-searchbot` (Anthropic, 3/3),
   `gptbot-vs-oai-searchbot-vs-chatgpt-user` (OpenAI, 3 of 4 — see note below),
   `perplexitybot-vs-perplexity-user` (Perplexity, 2/2), `applebot-vs-applebot-extended` (Apple,
   2 of eventual 3, gated on the pending registry release), `google-extended-vs-googlebot`
   (Google, 2 of 4 — see note below).

A new operator-page template would duplicate this existing coverage rather than add something a
visitor can't already get. Per Phase 2 §37's content-moat test — "could a generic model produce
essentially the same page without CrawlPact's governed data" — a plain operator roster page would
fail that test; the real value here is already expressed through the registry-driven cross-links,
not through a fourth page type.

**Deferred.** Revisit if an operator ever has enough governed crawlers, with different-enough
purposes, that the existing "related crawlers" widget plus a comparison guide genuinely can't
convey the relationships clearly — not the case for any of the current 9 operators.

## Two related but distinct observations (not gaps, judgment calls)

- **OpenAI's comparison guide covers 3 of 4 crawlers** (`GPTBot`, `OAI-SearchBot`,
  `ChatGPT-User`), deliberately excluding `OAI-AdsBot`. Read the guide in full: its stated purpose
  is the training/search/user-triggered confusion pattern ("treating them as one 'OpenAI bot'"),
  and `OAI-AdsBot`'s `advertising_validation` purpose is a different category from all three —
  including it would dilute the guide's specific thesis rather than complete it. Judged as a
  deliberate scope choice, not an oversight; not changed.
- **Google's comparison guide covers 2 of 4 crawlers** (`Googlebot`, `Google-Extended`),
  excluding `GoogleOther` (purpose: `unknown`, per Phase 1's own registry data) and
  `Google-CloudVertexBot` (purpose: `agent`, a site-owner-requested Vertex AI crawl, not a
  passive concern for most readers). Same reasoning: the guide's thesis is specifically the
  Search-vs-training-opt-out confusion, which only involves the two crawlers it covers. Not
  changed.

Both are flagged here for the record rather than silently treated as complete, per this audit's
own evidence-over-assumption standard — but neither is being fixed, since forcing a 4-way
comparison into a guide whose value comes from a focused 2-or-3-way distinction would make the
guide worse, not better.
