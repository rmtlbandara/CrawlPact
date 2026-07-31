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

## Site-owner controls

Disallowing `Meta-ExternalFetcher` prevents Meta's agentic AI features from fetching this
specific page on a user's behalf — a single-page, user-directed retrieval, not a bulk crawl. It
does not affect `Meta-ExternalAgent` (bulk AI-training crawling), `Meta-WebIndexer` (search), or
`Meta-ExternalAds` (advertising validation), each of which Meta documents as a separate token.
See [/limitations](/limitations) for what a `robots.txt` rule can and cannot guarantee.
