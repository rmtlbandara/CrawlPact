---
name: "Meta-WebIndexer"
operator: "Meta"
userAgentToken: "Meta-WebIndexer"
purpose: "search"
lifecycleStatus: "active"
officialSourceUrl: "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/"
lastVerified: "2026-07-24"
summary: "Navigates the web to improve Meta AI search result quality."
---

Meta documents `Meta-WebIndexer` as a crawler that "navigates the web to improve Meta AI search
result quality for users" by analysing content to enhance relevance and accuracy — a
search-purpose crawler, distinct from `Meta-ExternalAgent`'s training purpose.

## A note on the token

Meta's own documentation writes the literal user-agent string in lowercase,
`meta-webindexer/1.1`. `robots.txt` user-agent matching is case-insensitive (RFC 9309 §2.2.1), so
this does not change how a `Disallow` rule applies — CrawlPact displays crawler names in the
capitalisation convention used consistently across this directory.

## Site-owner controls

Disallowing `Meta-WebIndexer` affects this content's relevance and accuracy in Meta AI's search
results specifically. It does not affect `Meta-ExternalAgent` (AI training), `Meta-ExternalAds`
(advertising validation), or `Meta-ExternalFetcher` (user-triggered agent fetches) — each is
governed by its own separate token. See [/limitations](/limitations) for what a `robots.txt` rule
can and cannot guarantee.
