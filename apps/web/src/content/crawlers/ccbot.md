---
name: "CCBot"
operator: "Common Crawl Foundation"
userAgentToken: "CCBot"
purpose: "research"
lifecycleStatus: "active"
officialSourceUrl: "https://commoncrawl.org/ccbot"
lastVerified: "2026-07-01"
summary: "Builds the open Common Crawl web corpus, which is reused by many third-party model trainers."
---

`CCBot` is operated by the non-profit Common Crawl Foundation to build a large, openly available
web crawl dataset.

## Why it matters for AI policy specifically

Common Crawl's dataset is widely reused as a training source by third parties beyond Common
Crawl itself. A website that blocks every named AI-training crawler but leaves `CCBot`
unaddressed may still have its content indirectly available for training through downstream
reuse of the Common Crawl corpus — a conflict CrawlPact surfaces explicitly rather than
silently.
