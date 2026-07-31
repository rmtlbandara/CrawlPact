---
name: "Googlebot"
operator: "Google"
userAgentToken: "Googlebot"
purpose: "search"
lifecycleStatus: "active"
officialSourceUrl: "https://developers.google.com/search/docs/crawling-indexing/googlebot"
lastVerified: "2026-07-24"
summary: "Google's primary web crawler for Search indexing — not an AI-training-specific crawler."
---

Google's Search Central documentation describes `Googlebot` as "the generic name for two types of
web crawlers used by Google Search": a desktop crawler and a mobile crawler that simulate a user
browsing a site, used to crawl and index content for Google Search results.

## Why CrawlPact tracks Googlebot

`Googlebot` is not an AI-training crawler — it exists for conventional search indexing. CrawlPact
includes it in the registry because a website's overall crawler posture (which bots are
allowed, and why) is easier to reason about when a general-purpose search crawler is shown
alongside AI-specific ones like `Google-Extended`, which separately controls use of content for
training Gemini and Vertex AI generative models.

## A note on this record

Google's own page describes how to identify Googlebot subtypes by their `user-agent` header but
does not spell out a single literal token string on that page — `Googlebot` is the name Google
uses consistently across its own documentation and is the value CrawlPact matches against in
`robots.txt`.

## Site-owner controls

Disallowing `Googlebot` removes a page from Google Search indexing entirely — the most
consequential single crawler decision on this list for most public websites, since it governs
organic search visibility rather than any AI-training-specific use. It is separate from
`Google-Extended` (generative-AI training opt-out) and `Google-CloudVertexBot`
(site-owner-requested Vertex AI Agent crawls): blocking either of those does not affect Search
indexing, and blocking `Googlebot` does not, by itself, opt content out of the AI training use
`Google-Extended` governs. See [/limitations](/limitations) for what a `robots.txt` rule can and
cannot guarantee.
