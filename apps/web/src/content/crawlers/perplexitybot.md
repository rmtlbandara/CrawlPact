---
name: "PerplexityBot"
operator: "Perplexity AI"
userAgentToken: "PerplexityBot"
purpose: "search"
lifecycleStatus: "active"
officialSourceUrl: "https://docs.perplexity.ai/guides/bots"
lastVerified: "2026-09-08"
summary: "Indexes web content to power Perplexity's AI-generated search answers; Perplexity's own documentation recommends allowing it in robots.txt and states it respects robots.txt rules."
---

`PerplexityBot` crawls and indexes web content that Perplexity's search product may cite when
answering user queries. Perplexity's own documentation states this crawler respects `robots.txt`
rules, and recommends allowing `PerplexityBot` in your site's `robots.txt` file if you want your
content to be discoverable in Perplexity's search results.

## Site-owner controls

Disallowing `PerplexityBot` removes this content from consideration when Perplexity's search
product cites sources in its AI-generated answers — and, unlike `Perplexity-User`, this rule is
actually honoured, since Perplexity's documentation confirms `PerplexityBot` respects
`robots.txt`. It does not affect `Perplexity-User`, the separate user-triggered fetcher Perplexity
documents, which generally ignores `robots.txt` and operates independently of indexing decisions.
See [/limitations](/limitations/) for what a `robots.txt` rule can and cannot guarantee.

## Related crawler

Perplexity also documents `Perplexity-User`, a separate user-triggered crawler that fetches a
specific page in direct response to a user's request inside a Perplexity product. CrawlPact
reports these as distinct rows in the crawler matrix because they serve different purposes.
