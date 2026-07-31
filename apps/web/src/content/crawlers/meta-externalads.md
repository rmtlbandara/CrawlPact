---
name: "Meta-ExternalAds"
operator: "Meta"
userAgentToken: "Meta-ExternalAds"
purpose: "advertising_validation"
lifecycleStatus: "active"
officialSourceUrl: "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/"
lastVerified: "2026-07-24"
summary: "Crawls the web for use cases such as improving advertising and other business-related products."
---

Meta documents `Meta-ExternalAds` as a crawler used "for use cases such as improving advertising
and other business-related products" — an advertising/validation-purpose crawler, distinct from
Meta's AI training and search crawlers.

## A note on the token

Meta's own documentation writes the literal user-agent string in lowercase,
`meta-externalads/1.1`. `robots.txt` user-agent matching is case-insensitive (RFC 9309 §2.2.1),
so this does not change how a `Disallow` rule applies.

## Site-owner controls

Disallowing `Meta-ExternalAds` affects only Meta's advertising- and business-product-related
crawling of this content. It does not affect `Meta-ExternalAgent` (AI training),
`Meta-WebIndexer` (search), or `Meta-ExternalFetcher` (user-triggered agent fetches) — Meta
documents each as a separate token, and CrawlPact evaluates them independently. See
[/limitations](/limitations) for what a `robots.txt` rule can and cannot guarantee.
