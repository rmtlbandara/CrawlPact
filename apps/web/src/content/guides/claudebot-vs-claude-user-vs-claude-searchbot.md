---
title: "ClaudeBot vs. Claude-User vs. Claude-SearchBot: which should you block?"
description: "Anthropic operates three separate crawler tokens for training, user-triggered retrieval, and search. A decision guide for configuring each independently."
category: "decision"
publishedDate: "2026-07-24"
relatedCrawlerSlugs: ["claudebot", "claude-user", "claude-searchbot"]
---

Like OpenAI, Anthropic documents three separate crawler tokens rather than one combined identity.
Each is triggered differently and each needs its own `robots.txt` decision.

## The three tokens

- [`ClaudeBot`](/crawlers/claudebot) — training. Collects publicly accessible web content that
  could contribute to training Anthropic's models.
- [`Claude-User`](/crawlers/claude-user) — user-triggered. Fetches a page because a person
  directed Claude to access it as part of a query.
- [`Claude-SearchBot`](/crawlers/claude-searchbot) — search. Navigates the web to improve the
  relevance and accuracy of Claude's search results.

## The decision

- Disallow `ClaudeBot` to opt out of having your content used for Anthropic's model training,
  without affecting user-triggered fetches or search relevance.
- Leave `Claude-User` allowed unless you want to prevent Claude from ever fetching your pages on
  a user's direct request — this is a per-request, user-initiated fetch, not a bulk crawl.
- Leave `Claude-SearchBot` allowed if you want your pages to inform Claude's search results.

## Common mistake CrawlPact flags

Anthropic's own documentation gives a single example — `User-agent: ClaudeBot` / `Disallow: /` —
which some site owners assume also covers `Claude-User` and `Claude-SearchBot` because the
example only names one token. It doesn't: each token is matched independently. CrawlPact's
[AI crawler checker](/tools/ai-crawler-checker) evaluates all three against your `robots.txt`
so any unintended gap between them is visible before it matters.
