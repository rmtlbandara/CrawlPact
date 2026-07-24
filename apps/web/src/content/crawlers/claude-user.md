---
name: "Claude-User"
operator: "Anthropic"
userAgentToken: "Claude-User"
purpose: "user_triggered"
lifecycleStatus: "active"
officialSourceUrl: "https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler"
lastVerified: "2026-07-24"
summary: "Fetches a web page when a person directs Claude to access it as part of a query."
---

Anthropic documents `Claude-User` as the crawler that lets Claude access a website when a user
directs it to do so as part of their query — a user-initiated request, not a bulk crawl.

## Why this is different from ClaudeBot

`Claude-User` is tracked separately from the training-purpose `ClaudeBot` and the
search-purpose `Claude-SearchBot`. A website can restrict one without restricting the others —
CrawlPact's "Allow Search, Block Training" preset relies on exactly this kind of distinction.

## Site-owner controls

Standard `robots.txt` disallow rules apply. See [/limitations](/limitations) for what a
`robots.txt` rule can and cannot guarantee.
