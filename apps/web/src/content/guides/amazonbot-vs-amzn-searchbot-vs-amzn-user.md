---
title: "Amazonbot vs. Amzn-SearchBot vs. Amzn-User: which should you block?"
description: "Amazon documents three separate crawler tokens with different purposes and, critically, different robots.txt compliance. A decision guide for configuring each independently."
category: "decision"
publishedDate: "2026-09-08"
relatedCrawlerSlugs: ["amazonbot", "amzn-searchbot", "amzn-user"]
---

Amazon documents three crawler tokens on a single page, which is why a search for "amazonbot user
agent" often surfaces more than one CrawlPact crawler page — they share a common Amazon origin,
but each has a distinct purpose and, unlike some other operators' crawler families, each has
distinct `robots.txt` compliance behaviour too.

## The three tokens

- [`Amazonbot`](/crawlers/amazonbot/) — mixed use. Amazon's documentation states it "is used to
  improve our products and services" and "may be used to train Amazon AI models." This is the only
  one of the three associated with possible AI training.
- [`Amzn-SearchBot`](/crawlers/amzn-searchbot/) — search. Improves search experiences across Amazon
  products, including Alexa-eligible content. Amazon's documentation states it is not used for
  generative AI model training.
- [`Amzn-User`](/crawlers/amzn-user/) — user-triggered. Fetches a specific page in direct response
  to a person's request, such as an Alexa query needing current information. Also not used for AI
  training.

## The decision

- Disallow `Amazonbot` to opt out of Amazon's general product-improvement crawling, including any
  possible AI-model-training use — this does not affect the other two tokens.
- Leave `Amzn-SearchBot` allowed if you want your pages eligible for Amazon's search-style
  experiences. If you disallow it, note that Amazon's documentation states this crawler otherwise
  falls back to whatever rule your `robots.txt` gives other search bots (a wildcard `User-agent: *`
  group, for example) when no `Amzn-SearchBot`-specific group exists — a blanket allow for "all
  search crawlers" already covers it.
- **A `Disallow` rule for `Amzn-User` is not a reliable way to stop it.** Amazon's own
  documentation states this token "may not follow all robots.txt directives" because its requests
  are triggered by a real person's action, not a bulk crawl — the same design choice Perplexity
  makes for its own user-triggered fetcher (see
  [PerplexityBot vs. Perplexity-User](/guides/perplexitybot-vs-perplexity-user/)). If you need to
  prevent this specific fetch, `robots.txt` alone will not guarantee it; see
  [/limitations](/limitations/) for what a `robots.txt` rule can and cannot guarantee.

## Common mistake CrawlPact flags

Site owners sometimes write a single `Amazonbot` rule expecting it to cover Amazon's crawling
broadly, then are surprised when `Amzn-SearchBot` or `Amzn-User` activity continues (or, in
`Amzn-User`'s case, continues regardless of what `robots.txt` says at all). Each token is matched
independently, and one of the three has documented, limited `robots.txt` compliance in the first
place. CrawlPact's [AI crawler checker](/tools/ai-crawler-checker/) evaluates all three against
your `robots.txt` so any unintended gap between them is visible before it matters.
