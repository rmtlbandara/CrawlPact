---
name: "Meta-ExternalAgent"
operator: "Meta"
userAgentToken: "Meta-ExternalAgent"
purpose: "training"
lifecycleStatus: "active"
officialSourceUrl: "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/"
lastVerified: "2026-07-01"
summary: "Used by Meta to crawl content for training AI models and improving AI products."
---

`Meta-ExternalAgent` is documented by Meta as a crawler used to gather content for training AI
models and for improving Meta's AI products and features.

## Site-owner controls

Disallowing `Meta-ExternalAgent` affects only Meta's AI-training use of this content. It does not
affect `Meta-WebIndexer` (search), `Meta-ExternalAds` (advertising validation), or
`Meta-ExternalFetcher` (user-triggered agent fetches) — Meta documents each as its own distinct
token, and CrawlPact evaluates them independently. See [/limitations](/limitations) for what a
`robots.txt` rule can and cannot guarantee.

## Distinguishing from Meta's other crawlers

Meta operates several distinctly named crawlers for different purposes (link previews,
indexing, and AI training). CrawlPact's registry tracks `Meta-ExternalAgent` specifically as a
training-purpose crawler; other Meta tokens are evaluated separately as the registry expands.
