---
name: "Claude-SearchBot"
operator: "Anthropic"
userAgentToken: "Claude-SearchBot"
purpose: "search"
lifecycleStatus: "active"
officialSourceUrl: "https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler"
lastVerified: "2026-07-24"
summary: "Navigates the web to improve the relevance and accuracy of Claude's search results."
---

Anthropic documents `Claude-SearchBot` as a crawler that "navigates the web to improve search
result quality for users," analyzing content specifically to enhance the relevance and accuracy
of search responses — distinct from `ClaudeBot`'s training purpose.

## Why the distinction matters

A website that wants to remain discoverable through Claude's search features while restricting
training use of its content needs to treat `Claude-SearchBot` and `ClaudeBot` as separate
decisions in `robots.txt`.

## Site-owner controls

Anthropic's own documentation gives this example for blocking any of its crawlers:

```
User-agent: Claude-SearchBot
Disallow: /
```

See [/limitations](/limitations) for what a `robots.txt` rule can and cannot guarantee.
