---
title: "RSL vs. Content Signals vs. robots.txt: which one wins when they disagree"
description: "Three separate, overlapping declarations can express AI training permissions. A decision guide for keeping them consistent and understanding what happens when they don't agree."
category: "decision"
publishedDate: "2026-07-24"
---

`robots.txt`, RSL, and Content Signals can each express a permission or restriction relevant to
AI crawling — and none of them is aware of the other two. Nothing enforces agreement between
them; that's left entirely to the site owner.

## The three declarations

- **`robots.txt`** — per-crawler-token allow/disallow rules, evaluated per URL path.
- **RSL** (Really Simple Licensing) — an XML declaration at `/.well-known/rsl.xml`, expressing
  permitted and prohibited uses (for example, permitting search use while prohibiting training
  use) plus optional payment terms.
- **Content Signals** — a `Content-Signal` HTTP response header (or, per the specification,
  potentially a `robots.txt` directive) expressing simple `key=value` pairs like `ai-train=no`.

## No single mechanism "wins"

None of these three specifications defines the other two as authoritative. A crawler operator
that only reads `robots.txt` will never see your RSL or Content Signals declaration, and vice
versa. The practical implication is that **all three need to say the same thing** for your
intent to reach every crawler that might check any one of them.

## What CrawlPact checks

CrawlPact's conflict detector specifically flags one disagreement: RSL prohibiting training use
while Content Signals declares `ai-train=yes` for the same site — a direct contradiction a
crawler could resolve either way depending on which signal it reads. It does not (and cannot)
resolve the disagreement for you; it only surfaces it so you can fix the declaration that's wrong.

## The decision

If you're publishing more than one of these three mechanisms, treat updating all of them together
as a single change, not three independent edits. CrawlPact's
[RSL validator](/tools/rsl-validator) and [Content Signals checker](/tools/content-signals-checker)
show each declaration on its own, so you can compare them directly before publishing.
