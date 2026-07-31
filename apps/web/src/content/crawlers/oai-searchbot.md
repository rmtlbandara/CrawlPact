---
name: "OAI-SearchBot"
operator: "OpenAI"
userAgentToken: "OAI-SearchBot"
purpose: "search"
lifecycleStatus: "active"
officialSourceUrl: "https://developers.openai.com/api/docs/bots"
lastVerified: "2026-07-24"
summary: "Used to discover and surface links to websites in ChatGPT search results."
---

`OAI-SearchBot` is OpenAI's documented crawler for surfacing and linking to web content inside
ChatGPT's search features, distinct from the training-focused `GPTBot`.

## Site-owner controls

Disallowing `OAI-SearchBot` removes this content from ChatGPT's search-style results. It does
not affect `GPTBot` (OpenAI's training crawler) or `ChatGPT-User` (fetches made in direct
response to a user's request inside ChatGPT) — both evaluated as separate tokens. See
[/limitations](/limitations) for what a `robots.txt` rule can and cannot guarantee.

## Why the distinction matters

A website that wants to remain discoverable through AI-assisted search while still restricting
training use of its content needs to treat `OAI-SearchBot` and `GPTBot` as separate decisions.
CrawlPact's "Allow Search, Block Training" preset is built around exactly this kind of
distinction.
