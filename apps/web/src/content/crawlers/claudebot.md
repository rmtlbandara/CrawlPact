---
name: "ClaudeBot"
operator: "Anthropic"
userAgentToken: "ClaudeBot"
purpose: "training"
lifecycleStatus: "active"
officialSourceUrl: "https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler"
lastVerified: "2026-07-24"
summary: "Used by Anthropic to crawl publicly accessible content for model training."
---

`ClaudeBot` is documented by Anthropic as the crawler used to gather publicly available web
content for training its Claude models.

## What blocking ClaudeBot does

Disallowing `ClaudeBot` in `robots.txt` signals that a website does not want its content used for
model training. It does not affect Anthropic's other documented crawlers, `Claude-User`
(user-triggered retrieval) or `Claude-SearchBot` (search relevance), which are evaluated and
reported separately by CrawlPact — a website can restrict training while remaining discoverable
through Claude's search or user-directed features.

## Site-owner controls

Anthropic documents standard `robots.txt` support for disallowing `ClaudeBot`. As with other
training-purpose crawlers, blocking it is a declared-policy signal only — see
[/limitations](/limitations/) for what a `robots.txt` rule can and cannot guarantee.
