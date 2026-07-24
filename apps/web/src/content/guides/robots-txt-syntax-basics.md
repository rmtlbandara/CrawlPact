---
title: "robots.txt syntax basics for AI crawler tokens"
description: "How User-agent groups, Allow, Disallow, and Sitemap directives are evaluated, and where AI crawler tokens fit in."
category: "implementation"
publishedDate: "2026-07-01"
---

`robots.txt` is a plain-text file at the root of a domain (`/robots.txt`) made up of one or more
`User-agent` groups, each containing `Allow` and `Disallow` directives, plus optional `Sitemap`
declarations.

## Group matching

A crawler matches the most specific `User-agent` group that names its token exactly; if no exact
match exists, it falls back to the wildcard (`User-agent: *`) group. Within a matching group, the
longest matching path rule wins when `Allow` and `Disallow` rules conflict for the same path —
this is the RFC 9309 behaviour CrawlPact's parser follows (see [/methodology](/methodology)).

## Adding an AI-specific rule

```
User-agent: GPTBot
Disallow: /
```

This creates a dedicated group for a single crawler token without affecting the wildcard group
that other, unlisted crawlers fall back to. CrawlPact's recommendation engine generates rules in
this shape, preserving unrelated existing directives (SRS FR-REC-004).
