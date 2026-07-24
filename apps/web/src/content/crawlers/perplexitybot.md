---
name: "PerplexityBot"
operator: "Perplexity AI"
userAgentToken: "PerplexityBot"
purpose: "search"
lifecycleStatus: "active"
officialSourceUrl: "https://docs.perplexity.ai/guides/bots"
lastVerified: "2026-07-01"
summary: "Indexes web content to power Perplexity's AI-generated search answers."
---

`PerplexityBot` crawls and indexes web content that Perplexity's search product may cite when
answering user queries.

## Related crawler

Perplexity also documents `Perplexity-User`, a separate user-triggered crawler that fetches a
specific page in direct response to a user's request inside a Perplexity product. CrawlPact
reports these as distinct rows in the crawler matrix because they serve different purposes.
