---
name: "Amzn-User"
operator: "Amazon"
userAgentToken: "Amzn-User"
purpose: "user_triggered"
lifecycleStatus: "active"
officialSourceUrl: "https://developer.amazon.com/amazonbot"
lastVerified: "2026-09-08"
summary: "Fetches a page on behalf of an end user or Amazon application, such as responding to an Alexa query that needs up-to-date information; not used for generative AI model training; Amazon's own documentation states it may not follow all robots.txt directives."
---

`Amzn-User` fetches individual pages in direct response to a user action or an Amazon
application's request — for example, retrieving up-to-date information to answer an Alexa
query. Amazon's own documentation states this crawler is not used to train generative AI models.

## A `robots.txt` limitation worth knowing

Amazon's own documentation states that `Amzn-User` "may not follow all robots.txt directives"
because its requests are triggered by a specific person, not a bulk crawl. A `Disallow` rule aimed
at this token is not a reliable way to prevent this specific page from being fetched on a user's
behalf — see [/limitations](/limitations/) for what a `robots.txt` rule can and cannot guarantee
more generally.

## Site-owner controls

A `robots.txt` rule for `Amzn-User` may not be honoured consistently, per Amazon's own
documentation above. It does not affect `Amazonbot` (Amazon's mixed-use, possibly-training
crawler) or `Amzn-SearchBot` (search-experience indexing, which does honour `robots.txt`), both
documented separately.

## Related crawlers

Amazon documents `Amzn-User` alongside `Amzn-SearchBot` (search-experience crawling, also
excluded from AI training) and `Amazonbot` (mixed use, including possible AI training) on the
same page. See
[Amazonbot vs. Amzn-SearchBot vs. Amzn-User](/guides/amazonbot-vs-amzn-searchbot-vs-amzn-user/) for
a side-by-side comparison.
