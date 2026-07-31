---
title: "Google-Extended vs. Googlebot: what each one actually controls"
description: "A decision guide for separating AI-training opt-out from Search indexing when configuring robots.txt for Google's crawlers."
category: "decision"
publishedDate: "2026-07-01"
relatedCrawlerSlugs: ["google-extended", "googlebot"]
---

Google operates [`Googlebot`](/crawlers/googlebot/) for Search indexing and
[`Google-Extended`](/crawlers/google-extended/) as a separate opt-out token for generative AI
training use (Gemini, Vertex AI). These are frequently confused because they come from the same
operator and are often configured in the same `robots.txt` file.

## The decision

- Disallow [`Googlebot`](/crawlers/googlebot/) only if you want to leave Google Search entirely —
  this is rarely the right choice for a public website that depends on organic search traffic.
- Disallow [`Google-Extended`](/crawlers/google-extended/) if you want to opt specific content out
  of generative AI training while keeping full Search visibility.

## Common mistake CrawlPact flags

Copying a "block all AI" `robots.txt` snippet from a general audience article often disallows
`Googlebot` by accident, alongside AI-specific tokens. CrawlPact's conflict detector raises this
as a high-severity finding when a preset that expects search visibility is combined with a rule
that blocks `Googlebot`.

Check which of the two your own site currently allows or blocks with the
[AI crawler checker](/tools/ai-crawler-checker/).
