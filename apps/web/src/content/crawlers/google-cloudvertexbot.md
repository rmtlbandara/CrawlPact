---
name: "Google-CloudVertexBot"
operator: "Google"
userAgentToken: "Google-CloudVertexBot"
purpose: "agent"
lifecycleStatus: "active"
officialSourceUrl: "https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers"
lastVerified: "2026-07-24"
summary: "Crawls requested by site owners for building Vertex AI Agents."
---

Google's own crawler documentation describes `Google-CloudVertexBot` as affecting "crawls
requested by site owners for building Vertex AI Agents." Unlike `Googlebot` or `Google-Extended`,
this crawler acts on a specific site owner's own request, rather than a general web-wide sweep.

## Why this is categorised as "agent"

Google's documentation frames this crawler around a site owner's own request to build an AI
agent against their content, which fits CrawlPact's registry's "agent" purpose category more
than a general search or bulk-training crawl.

## Site-owner controls

Disallowing `Google-CloudVertexBot` prevents crawls performed specifically because a site owner
(not necessarily you) requested that a Vertex AI Agent be built against this content. It does not
affect Google Search indexing (`Googlebot`) or the generative-AI-training opt-out
(`Google-Extended`) — this token governs only agent-initiated, request-driven access, not a
general web-wide crawl. See [/limitations](/limitations) for what a `robots.txt` rule can and
cannot guarantee.
