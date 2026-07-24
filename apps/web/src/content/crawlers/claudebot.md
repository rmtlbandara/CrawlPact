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

## Site-owner controls

Anthropic documents standard `robots.txt` support for disallowing `ClaudeBot`. As with other
training-purpose crawlers, blocking it is a declared-policy signal only — see
[/limitations](/limitations) for what a `robots.txt` rule can and cannot guarantee.
