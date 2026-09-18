---
Document owner: Engineering owner
Status: current-authoritative (Phase 2, §7 prep — real content inventory)
---

# Content Inventory — 2026-09-17

A real inventory of what exists today, read directly from the repository (not assumed from
memory or prior phase docs), to ground Phase 2's content-gap analysis (§7) once real GSC query
data is available.

## Content collections (`apps/web/src/content/`)

| Collection  | Count | Notes                                                                        |
| ----------- | ----- | ---------------------------------------------------------------------------- |
| `crawlers`  | 22    | Per-crawler markdown pages, rendered at `/crawlers/[slug]`                   |
| `guides`    | 21    | How-to / troubleshooting / comparison guides at `/guides/[slug]`             |
| `platforms` | 5     | cloudflare, netlify, shopify, vercel, wordpress — `/platforms/[slug]`        |
| `verticals` | 4     | agencies, publishers, saas-and-documentation, web-developers — `/for/[slug]` |

Guide topics present today span: crawler-vs-crawler comparisons (Amazon, Apple, Claude, Google,
GPT, Meta, Perplexity — 7 of the 21), protocol how-tos (llms.txt, RSL, Content Signals header, 4
of 21), troubleshooting (crawler-shows-resource-unavailable, llms-txt-not-validating,
robots-txt-rule-not-blocking-a-crawler, rsl-or-content-signals-not-detected, policy-health-score-
dropped — 5 of 21), and conceptual pieces (robots.txt basics, robots.txt vs. meta-robots vs.
X-Robots-Tag, RSL vs. Content Signals vs. robots.txt, blocking training while staying visible,
should-you-block-ccbot, how-to-block-only-AI-training — 6 of 21).

Note: `crawlers` collection has 22 markdown files against the live registry's 23 published +
1 unpublished (`Applebot`) = 24 total governed crawlers. An `applebot-vs-applebot-extended.md`
comparison guide already exists even though base `Applebot` isn't in a published release yet —
this is a real, pre-existing content/registry mismatch worth resolving once the registry release
in `REGISTRY_RELEASE_DECISION.md` is published (the comparison guide's claims about base Applebot
should be checked against the live registry entry at that point, and a dedicated `/crawlers/
applebot` page should exist to match `/crawlers/applebot-extended`).

## Standalone tools (`/tools/`)

5 free interactive validators: AI crawler checker, Robots.txt AI validator, RSL validator,
llms.txt validator, Content Signals checker — each a real, functioning, unauthenticated tool
against a caller-supplied domain (this is CrawlPact's existing free-tool distribution surface,
not something Phase 2 needs to build from scratch).

## Registry-authority surfaces

- `/crawlers/` (index) + `/crawlers/[slug]` (22 pages) — per-crawler detail pages.
- `/observatory/` (index), `/observatory/registry`, `/observatory/methodology` — the existing
  registry-transparency surface Phase 2's authority narrative builds on.
- `/research/` (index) + `/research/[slug]` — infrastructure live, **zero published entries**
  (see `RESEARCH_PUBLICATION_EVIDENCE.md`).

## Core marketing/product pages

`index`, `pricing`, `about`, `methodology`, `scoring`, `security`, `changelog`, `sample-report`,
`limitations`, `acceptable-use`, `contact`, `status` (+ its Atom feed), `privacy`, `terms` — all
pre-existing, none touched this phase.

## What this inventory does not yet answer

Which of these pages already rank, which have real (even if small) impressions, and where the
actual content gaps are relative to real search demand — that requires real GSC query-level data,
which does not exist until the first `growth_collection` run (2026-09-18 03:00 UTC). This
inventory is the "what exists" half of §7's gap analysis; the "what's missing relative to demand"
half is deferred, honestly, until that data lands — consistent with `PHASE_2_BASELINE.md`.
