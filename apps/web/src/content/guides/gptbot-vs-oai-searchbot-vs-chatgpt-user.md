---
title: "GPTBot vs. OAI-SearchBot vs. ChatGPT-User: which should you block?"
description: "OpenAI operates three separate crawler tokens for three separate purposes. A decision guide for choosing which, if any, to disallow."
category: "decision"
publishedDate: "2026-07-24"
---

OpenAI documents three distinct crawler tokens, each triggered by a different thing. Treating
them as one "OpenAI bot" and blocking or allowing all three together is the most common
misconfiguration CrawlPact sees in this operator's traffic.

## The three tokens

- [`GPTBot`](/crawlers/gptbot) — training. Crawls content that may inform future model training.
- [`OAI-SearchBot`](/crawlers/oai-searchbot) — search. Surfaces and links to pages in ChatGPT
  search results.
- [`ChatGPT-User`](/crawlers/chatgpt-user) — user-triggered. Fetches a specific page because a
  person asked ChatGPT a direct question about it.

## The decision

- Disallow `GPTBot` if you don't want your content used for OpenAI's model training. This has no
  effect on whether your site can be found through ChatGPT search.
- Leave `OAI-SearchBot` allowed if you want your pages discoverable through ChatGPT's search
  features — disallowing it removes that visibility entirely, similar to disallowing a search
  engine's indexer.
- Leave `ChatGPT-User` allowed unless you specifically don't want any content served in response
  to direct user questions inside ChatGPT — blocking it does not reduce training or search
  exposure, since it's a separate, user-initiated request path.

## Common mistake CrawlPact flags

A single `User-agent: GPTBot` group is sometimes assumed to cover "all of OpenAI." It doesn't —
`robots.txt` groups match on the exact token named, with no fallback to a shared vendor identity.
Each token needs its own explicit `Disallow` if you want to restrict it. CrawlPact's
[AI crawler checker](/tools/ai-crawler-checker) shows the result for all three, evaluated
independently, so a gap is visible immediately.
