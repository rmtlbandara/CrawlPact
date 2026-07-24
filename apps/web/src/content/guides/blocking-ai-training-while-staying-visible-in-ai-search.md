---
title: "Blocking AI training while staying visible in AI search"
description: "Choosing between CrawlPact's presets when the goal is opting out of model training without losing AI-search discoverability."
category: "decision"
publishedDate: "2026-07-24"
---

A common, specific goal is: don't let AI companies train on my content, but stay discoverable
when people ask AI assistants questions related to it. This is achievable, but it depends on
distinguishing training-purpose crawlers from search-purpose and user-triggered crawlers for
every operator individually — there's no single switch that does both at once.

## Why this needs per-operator, per-purpose decisions

Every operator that separates its crawlers by purpose gives you this choice independently:

- OpenAI: allow `OAI-SearchBot` and `ChatGPT-User`, disallow `GPTBot`.
- Anthropic: allow `Claude-SearchBot` and `Claude-User`, disallow `ClaudeBot`.
- Google: allow `Googlebot`, disallow `Google-Extended`.
- Apple: allow `Applebot`, disallow `Applebot-Extended`.
- Meta: allow `Meta-WebIndexer`, disallow `Meta-ExternalAgent`.

Operators that don't separate purpose this way (Amazon's `Amazonbot`, categorised `mixed`) don't
offer this choice at the token level — there's no way to permit search use while blocking training
use of the same crawler, because the operator's own documentation doesn't distinguish them.

## CrawlPact's preset for this

The **Allow Search, Block Training** preset expects every crawler purpose-categorised `search` or
`user_triggered` to be allowed, and every crawler categorised `training` or `research` to be
blocked — evaluated per crawler, using the registry's purpose classification, not a single
site-wide switch. Crawlers with a `mixed` purpose are flagged for an explicit decision, since no
single expectation fits.

## What this can't guarantee

A `robots.txt` rule is a declared instruction, not an enforcement mechanism — see
[/limitations](/limitations). It also can't retroactively affect content already used in a prior
training run, and it has no effect on crawlers CrawlPact's registry doesn't yet track (an unknown
or newly-introduced token, which the registry lists as `unverified` rather than presenting a
guess).
