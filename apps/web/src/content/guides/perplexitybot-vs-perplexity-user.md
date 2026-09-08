---
title: "PerplexityBot vs. Perplexity-User: which should you block?"
description: "Perplexity separates its search-indexing crawler from its user-triggered fetcher — and only one of them actually honours robots.txt. A decision guide for configuring each independently."
category: "decision"
publishedDate: "2026-07-24"
updatedDate: "2026-09-08"
relatedCrawlerSlugs: ["perplexitybot", "perplexity-user"]
---

Perplexity documents two crawler tokens with a clear, stated separation: one for indexing, one for
answering a specific question — and, importantly, only one of them reliably respects `robots.txt`.

## The two tokens

- [`PerplexityBot`](/crawlers/perplexitybot/) — search. Perplexity states this crawler is
  "designed to surface and link websites in search results on Perplexity," is explicitly not
  used to train AI foundation models, and **respects `robots.txt`**.
- [`Perplexity-User`](/crawlers/perplexity-user/) — user-triggered. Fetches a page when a person
  asks Perplexity a question that requires visiting it directly, and Perplexity's own
  documentation states it **generally ignores `robots.txt`** because a specific person, not a
  bulk crawl, requested the fetch.

## The decision

- Disallowing `PerplexityBot` removes your site from being indexed and cited in Perplexity's
  search answers — this is the closest equivalent to blocking a conventional search engine, and
  this rule is actually honoured.
- Disallowing `Perplexity-User` is **not a reliable way** to prevent Perplexity from fetching your
  page on a user's direct request — Perplexity's documentation states this fetcher generally
  ignores `robots.txt` precisely because a real person asked the question. If you need to prevent
  that specific fetch, a `robots.txt` rule alone is not sufficient; see
  [/limitations](/limitations/) for what a `robots.txt` rule can and cannot guarantee.
- Because Perplexity states neither token is used for foundation model training, there is no
  separate "training opt-out" decision to make for this operator, unlike OpenAI, Anthropic,
  Google, or Meta.

## Common mistake CrawlPact flags

Site owners who want to "opt out of AI training" sometimes disallow `PerplexityBot` expecting a
training effect, then are surprised their site loses Perplexity search visibility with no
training-related benefit, since Perplexity's own documentation states this crawler isn't used for
that purpose. Confirm what a token actually does — via the
[crawler directory](/crawlers/) — before writing a rule intended to achieve a specific outcome, or
check your own `robots.txt` directly with the [AI crawler checker](/tools/ai-crawler-checker/).
