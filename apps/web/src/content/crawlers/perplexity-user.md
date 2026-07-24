---
name: "Perplexity-User"
operator: "Perplexity AI"
userAgentToken: "Perplexity-User"
purpose: "user_triggered"
lifecycleStatus: "active"
officialSourceUrl: "https://docs.perplexity.ai/guides/bots"
lastVerified: "2026-07-24"
summary: "Fetches a page in direct response to a user's question inside Perplexity."
---

Perplexity documents `Perplexity-User` as supporting "user actions within Perplexity. When users
ask Perplexity a question, it might visit a web page to help provide an accurate answer" and
include relevant links in the response. Perplexity states it is "not employed for web crawling or
AI model training."

## Why this is different from PerplexityBot

`Perplexity-User` requests are triggered by a specific person's question, not a bulk crawl. It is
tracked separately from the search-indexing `PerplexityBot` — a website can restrict one without
restricting the other.

## Site-owner controls

Standard `robots.txt` disallow rules apply. See [/limitations](/limitations) for what a
`robots.txt` rule can and cannot guarantee.
