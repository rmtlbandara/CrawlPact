---
name: "Perplexity-User"
operator: "Perplexity AI"
userAgentToken: "Perplexity-User"
purpose: "user_triggered"
lifecycleStatus: "active"
officialSourceUrl: "https://docs.perplexity.ai/guides/bots"
lastVerified: "2026-09-08"
summary: "Fetches a page in direct response to a user's question inside Perplexity; Perplexity's own documentation states it generally ignores robots.txt rules."
---

Perplexity documents `Perplexity-User` as supporting "user actions within Perplexity. When users
ask Perplexity a question, it might visit a web page to help provide an accurate answer" and
include relevant links in the response. Perplexity states it is "not employed for web crawling or
AI model training."

## Why this is different from PerplexityBot

`Perplexity-User` requests are triggered by a specific person's question, not a bulk crawl. It is
tracked separately from the search-indexing `PerplexityBot`.

## A `robots.txt` limitation worth knowing

Perplexity's own documentation states that, "since a user requested the fetch, this fetcher
generally ignores robots.txt rules." A `Disallow` rule aimed at `Perplexity-User` is not a
reliable way to prevent this specific page from being fetched on a user's behalf — this is a
documented, deliberate design choice by Perplexity, not a CrawlPact-observed workaround. See
[/limitations](/limitations/) for what a `robots.txt` rule can and cannot guarantee more generally.

## Site-owner controls

A `robots.txt` rule for `Perplexity-User` may not be honoured, per Perplexity's own documentation
above — this differs from `PerplexityBot`, which does respect `robots.txt`.
