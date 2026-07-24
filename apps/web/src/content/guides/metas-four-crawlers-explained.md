---
title: "Meta's four crawlers explained: ExternalAgent, WebIndexer, ExternalAds, ExternalFetcher"
description: "Meta documents four separate crawler tokens with four separate purposes. A decision guide for telling them apart before writing a robots.txt rule."
category: "decision"
publishedDate: "2026-07-24"
---

Meta documents more separate crawler tokens than most other operators, each for a distinct
purpose. Writing one `robots.txt` rule intending to cover "Meta AI" usually misses at least one of
them.

## The four tokens

- [`Meta-ExternalAgent`](/crawlers/meta-externalagent) — training. Crawls the web "for use cases
  such as training foundation AI models or improving products by indexing content directly."
- [`Meta-WebIndexer`](/crawlers/meta-webindexer) — search. Navigates the web to improve Meta AI
  search result quality.
- [`Meta-ExternalAds`](/crawlers/meta-externalads) — advertising/validation. Crawls for use cases
  such as improving advertising and other business-related products.
- [`Meta-ExternalFetcher`](/crawlers/meta-externalfetcher) — agent. Fetches individual links at a
  user's request, to support agentic AI capabilities in Meta products.

## The decision

- Disallow `Meta-ExternalAgent` to opt out of Meta's AI training use of your content.
- Disallow `Meta-WebIndexer` if you don't want your pages surfaced in Meta AI's search features.
- `Meta-ExternalAds` and `Meta-ExternalFetcher` serve narrower purposes (advertising products, and
  single-page fetches on a user's request, respectively) — most sites leave these two allowed
  unless they have a specific reason to restrict them.

## Common mistake CrawlPact flags

A `robots.txt` rule naming only `Meta-ExternalAgent` — the most widely discussed of the four —
leaves `Meta-WebIndexer`, `Meta-ExternalAds`, and `Meta-ExternalFetcher` completely unaffected,
since `robots.txt` groups never match on operator identity, only the exact token named. Note also
that Meta's own documentation writes these tokens in lowercase in the literal HTTP header (e.g.
`meta-externalagent/1.1`) — matching is case-insensitive per RFC 9309, so either capitalisation
works in a rule.
