---
title: "PerplexityBot vs. Perplexity-User: which should you block?"
description: "Perplexity separates its search-indexing crawler from its user-triggered fetcher. A decision guide for configuring each independently."
category: "decision"
publishedDate: "2026-07-24"
---

Perplexity documents two crawler tokens with a clear, stated separation: one for indexing, one for
answering a specific question.

## The two tokens

- [`PerplexityBot`](/crawlers/perplexitybot) — search. Perplexity states this crawler is
  "designed to surface and link websites in search results on Perplexity" and is explicitly not
  used to train AI foundation models.
- [`Perplexity-User`](/crawlers/perplexity-user) — user-triggered. Fetches a page when a person
  asks Perplexity a question that requires visiting it directly.

## The decision

- Disallowing `PerplexityBot` removes your site from being indexed and cited in Perplexity's
  search answers — this is the closest equivalent to blocking a conventional search engine.
- Disallowing `Perplexity-User` prevents Perplexity from fetching your page on a user's direct
  request, even if the user explicitly asked about your content.
- Because Perplexity states neither token is used for foundation model training, there is no
  separate "training opt-out" decision to make for this operator, unlike OpenAI, Anthropic,
  Google, or Meta.

## Common mistake CrawlPact flags

Site owners who want to "opt out of AI training" sometimes disallow `PerplexityBot` expecting a
training effect, then are surprised their site loses Perplexity search visibility with no
training-related benefit, since Perplexity's own documentation states this crawler isn't used for
that purpose. Confirm what a token actually does — via the
[crawler directory](/crawlers) — before writing a rule intended to achieve a specific outcome.
