---
name: "Amazonbot"
operator: "Amazon"
userAgentToken: "Amazonbot"
purpose: "mixed"
lifecycleStatus: "active"
officialSourceUrl: "https://developer.amazon.com/amazonbot"
lastVerified: "2026-09-08"
summary: "Used by Amazon to improve its products and services, including Alexa answers, and may be used to train Amazon AI models."
---

Amazon's own developer documentation states that "Amazonbot is used to improve our products and
services. This helps us provide more accurate information to customers and may be used to train
Amazon AI models." Its full user-agent string includes the token `Amazonbot/0.1`.

## Why this is categorised as "mixed"

Amazon's documentation does not separate Amazonbot into distinct training/search/product tokens
the way some other operators do — a single crawler serves multiple stated purposes at once.
CrawlPact's registry marks this as `mixed` purpose rather than guessing which use applies to any
specific request.

## Site-owner controls

Disallowing `Amazonbot` opts this content out of Amazon's general product-improvement crawling,
including any possible AI-model-training use its documentation describes. It does not affect the
separate `Amzn-SearchBot` (search-experience indexing) or `Amzn-User` (user-triggered fetches)
tokens Amazon documents on the same page — both explicitly excluded from AI training use, and
evaluated independently by CrawlPact. See [/limitations](/limitations/) for what a `robots.txt`
rule can and cannot guarantee.

## Related crawlers

Amazon documents `Amzn-SearchBot` (search-experience indexing, excluded from AI training) and
`Amzn-User` (user-triggered fetches, excluded from AI training) alongside Amazonbot on the same
page. All three respond to different queries such as "amazonbot user agent" because they share a
common Amazon origin, but they are distinct tokens with distinct rules — see
[Amazonbot vs. Amzn-SearchBot vs. Amzn-User](/guides/amazonbot-vs-amzn-searchbot-vs-amzn-user/) for
a side-by-side comparison, including how each one's `robots.txt` compliance actually differs.
