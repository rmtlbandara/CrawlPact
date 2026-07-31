---
name: "Amzn-SearchBot"
operator: "Amazon"
userAgentToken: "Amzn-SearchBot"
purpose: "search"
lifecycleStatus: "active"
officialSourceUrl: "https://developer.amazon.com/amazonbot"
lastVerified: "2026-07-30"
summary: "Improves search experiences in Amazon products and services; Amazon's own documentation states it is not used for generative AI model training."
---

`Amzn-SearchBot` crawls web content to improve search experiences across Amazon products and
services, including making content eligible to appear in search-style experiences such as Alexa.
Amazon's own documentation is explicit that this crawler is not used to train generative AI
models — that use is associated with the separate `Amazonbot` token.

## Site-owner controls

Disallowing `Amzn-SearchBot` removes this content's eligibility to appear in Amazon's
search-style experiences, including Alexa-eligible content. It does not affect `Amazonbot`
(Amazon's mixed-use crawler, which may include AI training) or `Amzn-User` (user-triggered
fetches) — both documented separately, and evaluated independently by CrawlPact. See
[/limitations](/limitations) for what a `robots.txt` rule can and cannot guarantee.

## Related crawlers

Amazon documents `Amzn-SearchBot` alongside two other tokens on the same page: `Amazonbot`
(mixed use, including possible AI training) and `Amzn-User` (user-triggered fetches on behalf of
Amazon apps and devices). CrawlPact reports these as distinct rows because they serve different
purposes and carry different training implications.
