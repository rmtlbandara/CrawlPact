---
title: "Applebot vs. Applebot-Extended: Search/Siri vs. Apple Intelligence"
description: "Apple separates its long-standing search crawler from a newer, generative-AI-specific opt-out token. A decision guide for telling them apart."
category: "decision"
publishedDate: "2026-07-24"
relatedCrawlerSlugs: ["applebot-extended"]
---

Apple operates `Applebot`, a long-established crawler for Siri and Spotlight Suggestions, and a
newer, separate token specifically for generative AI training opt-out.

## The two tokens

- `Applebot` — Apple's general-purpose crawler, used since well before the current wave of
  generative AI products, for features like Siri and Spotlight Suggestions.
- [`Applebot-Extended`](/crawlers/applebot-extended) — controls use of website content for
  training Apple Intelligence and other Apple generative AI models, independent of the base
  `Applebot` crawl.

## The decision

- Disallow `Applebot-Extended` if you want to opt content out of Apple's generative AI training
  specifically, while keeping Siri/Spotlight functionality intact.
- Disallowing `Applebot` itself affects the older Search/Siri features `Applebot` was built for —
  a broader decision than an AI-training-specific opt-out.
- If your goal is narrowly "opt out of AI training, keep everything else," `Applebot-Extended` is
  the correct, narrower token — the same pattern as Google's `Google-Extended` next to
  `Googlebot`.

## Common mistake CrawlPact flags

Because `Applebot-Extended` is the newer of the two tokens, some `robots.txt` files only contain
a rule for `Applebot` and assume it also covers the newer AI-training opt-out. It doesn't — the
two tokens are matched independently, so an AI-training opt-out intent requires an explicit
`Applebot-Extended` rule.

Check which of the two your own `robots.txt` actually covers with the
[AI crawler checker](/tools/ai-crawler-checker/).
