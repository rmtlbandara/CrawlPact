---
name: "Meta-ExternalFetcher"
operator: "Meta"
userAgentToken: "Meta-ExternalFetcher"
purpose: "agent"
lifecycleStatus: "active"
officialSourceUrl: "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/"
lastVerified: "2026-07-24"
summary: "Fetches individual links at a user's request to support agentic AI capabilities in Meta products."
---

Meta documents `Meta-ExternalFetcher` as a crawler that "fetches individual links at a user's
request" to support "evaluating and improving agentic AI capabilities — including helping AI
navigate websites to complete tasks for users." This is a user-directed, single-page fetch rather
than a bulk crawl.

## A note on the token

Meta's own documentation writes the literal user-agent string in lowercase,
`meta-externalfetcher/1.1`. `robots.txt` user-agent matching is case-insensitive (RFC 9309
§2.2.1), so this does not change how a `Disallow` rule applies.

## A `robots.txt` limitation worth knowing

Meta's own documentation states that this crawler "may bypass robots.txt because it performs
fetches that were requested by the user." A `Disallow` rule aimed at `Meta-ExternalFetcher` is
therefore not a reliable way to prevent a specific page from being fetched on a person's behalf —
this is Meta's documented position (wording checked against its crawler page on 2026-09-19), not
a CrawlPact-observed workaround. See [/limitations](/limitations/) for what a `robots.txt` rule
can and cannot guarantee more generally.

## Site-owner controls

A `robots.txt` rule for `Meta-ExternalFetcher` may not be honoured, per Meta's own documentation
above — a single-page, user-directed retrieval, not a bulk crawl. It does not affect
`Meta-ExternalAgent` (bulk AI-training crawling), `Meta-WebIndexer` (search), or
`Meta-ExternalAds` (advertising validation), each of which Meta documents as a separate token.
