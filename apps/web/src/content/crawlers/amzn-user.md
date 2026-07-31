---
name: "Amzn-User"
operator: "Amazon"
userAgentToken: "Amzn-User"
purpose: "user_triggered"
lifecycleStatus: "active"
officialSourceUrl: "https://developer.amazon.com/amazonbot"
lastVerified: "2026-07-30"
summary: "Fetches a page on behalf of an end user or Amazon application, such as responding to an Alexa query that needs up-to-date information; not used for generative AI model training."
---

`Amzn-User` fetches individual pages in direct response to a user action or an Amazon
application's request — for example, retrieving up-to-date information to answer an Alexa
query. Amazon's own documentation states this crawler is not used to train generative AI models.

## Site-owner controls

Disallowing `Amzn-User` prevents Amazon applications from fetching this specific page on a
user's behalf — for example, in response to an Alexa query. It does not affect `Amazonbot`
(Amazon's mixed-use, possibly-training crawler) or `Amzn-SearchBot` (search-experience
indexing), both documented separately. See [/limitations](/limitations) for what a `robots.txt`
rule can and cannot guarantee.

## Related crawlers

Amazon documents `Amzn-User` alongside `Amzn-SearchBot` (search-experience crawling, also
excluded from AI training) and `Amazonbot` (mixed use, including possible AI training) on the
same page. CrawlPact reports these as distinct rows because they serve different purposes and
carry different training implications.
