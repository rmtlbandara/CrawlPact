---
name: "Amazonbot"
operator: "Amazon"
userAgentToken: "Amazonbot"
purpose: "mixed"
lifecycleStatus: "active"
officialSourceUrl: "https://developer.amazon.com/amazonbot"
lastVerified: "2026-07-24"
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
evaluated independently by CrawlPact. See [/limitations](/limitations) for what a `robots.txt`
rule can and cannot guarantee.
