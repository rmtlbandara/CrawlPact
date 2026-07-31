---
title: "Should you block CCBot? What it does and doesn't stop"
description: "CCBot builds the open Common Crawl corpus, which many other AI model trainers reuse. A decision guide for what blocking it actually achieves."
category: "decision"
publishedDate: "2026-07-24"
relatedCrawlerSlugs: ["ccbot"]
---

[`CCBot`](/crawlers/ccbot) is operated by the Common Crawl Foundation, a nonprofit that publishes
a large, open web corpus reused by many third-party researchers and model trainers — not a single
company's product crawler.

## What blocking CCBot does

Disallowing `CCBot` prevents the Common Crawl Foundation's own crawler from adding your content to
future snapshots of its open corpus.

## What blocking CCBot does not do

- It has no effect on content already captured in prior Common Crawl snapshots, which remain
  published and reusable regardless of a later `robots.txt` change.
- It has no effect on any other operator's own crawler (`GPTBot`, `ClaudeBot`, and so on) — each
  is evaluated independently against your `robots.txt`.
- It does not identify or control which downstream organisations use the Common Crawl corpus for
  their own model training — that reuse happens outside CrawlPact's or the Common Crawl
  Foundation's visibility.

## The decision

If your objective is specifically "reduce future inclusion in a widely-reused open dataset,"
disallowing `CCBot` is the direct, effective action. If your objective is "prevent my content
from ever being used to train any AI model," blocking `CCBot` alone is not sufficient — the
research purpose category on this crawler reflects that its data has a wider downstream reach
than a single operator's own training pipeline, and CrawlPact cannot verify or enumerate every
downstream reuse.

See [/limitations](/limitations) for what a `robots.txt` rule can and cannot guarantee, or check
whether your own site currently allows or blocks CCBot with the
[AI crawler checker](/tools/ai-crawler-checker/).
