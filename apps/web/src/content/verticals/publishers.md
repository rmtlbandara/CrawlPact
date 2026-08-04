---
title: "AI crawler policy for publishers"
description: "Audit and monitor the difference between what your site tells AI search crawlers and what it tells AI training crawlers — with evidence, not guesswork."
audience: "Publishers"
primaryProblem: "Search and AI-training crawlers often warrant different decisions, but a site's public signals frequently don't distinguish them clearly — and CDN or deployment changes can alter the actual response without an editorial decision being made."
recommendedPlan: "pro"
relatedPlatformSlugs: ["cloudflare", "wordpress"]
relatedGuideSlugs:
  [
    "blocking-ai-training-while-staying-visible-in-ai-search",
    "metas-four-crawlers-explained",
    "how-to-block-only-ai-training-crawlers",
  ]
publishedDate: "2026-08-04"
---

## Why publishers face a distinct decision

A publisher's core tension is that "AI crawler" isn't one category. Search crawlers, AI-training
crawlers, retrieval/agent crawlers acting on a reader's behalf, and advertising-validation crawlers
can all request the same URL — and a publisher may reasonably want to stay visible in AI-powered
search while declining to have the same content used for model training, or vice versa. Getting
that distinction right requires knowing, specifically, which documented crawler tokens fall into
which category, and confirming that the site's actual published rules reflect the intended
decision — not assuming they do.

## Common publisher policy conflicts

- A `robots.txt` rule intended to block "AI bots generally" written against a single token, while
  several other documented tokens for the same or a different purpose remain unaddressed.
- A meta robots tag or `X-Robots-Tag` header that contradicts what `robots.txt` says for the same
  crawler.
- A CDN, caching layer, or CMS plugin silently regenerating or overriding a previously-set
  `robots.txt` after a platform migration or theme change.
- Search-crawler access left unintentionally restricted while trying to block training crawlers
  with an overly broad rule.

## Public-signal audit workflow

CrawlPact fetches and evaluates the actual public response — `robots.txt`, relevant meta
directives, and header signals — for a domain, cross-references it against a versioned, source-
cited crawler registry that classifies each documented crawler by purpose (search, training,
user-triggered retrieval, agent, advertising validation, research, or an honestly-recorded
"unspecified" when an operator hasn't documented one), and reports conflicts and unaddressed
crawlers as explicit findings, with the underlying evidence attached.

## Evidence and recommendations

Every finding cites what was actually fetched, not just a conclusion — a publisher's technical or
editorial team can verify a finding independently rather than taking CrawlPact's word for it.
Recommendations describe what a rule change would do; applying it is always a manual, deliberate
step.

## Monitoring

Automatic monitoring frequency depends on plan (Solo: monthly, Pro/Agency: weekly). A recheck
flags both a change to the site's own published policy and a change to CrawlPact's verified
crawler registry — relevant for publishers specifically because a registry correction (a newly
documented crawler, or a corrected purpose classification) can change what a previously-reviewed
policy effectively means, with zero change on the publisher's own site.

## Current product capabilities relevant here

- Automatic monitoring (Solo: monthly, Pro/Agency: weekly) with a private Atom feed for change
  alerts on Solo and above.
- Audit-history retention: 30 days (Free) up to 36 months (Agency), so a policy's evolution over
  time is preserved as evidence, not just its current state.
- Private, revocable report sharing on every plan, including Free — useful for sharing a finding
  internally between editorial and technical teams without publishing it.
- 2–20 manual re-scans per domain per month (plan-dependent), for rechecking immediately after a
  deliberate change rather than waiting for the next scheduled cycle.

## What CrawlPact does not do

CrawlPact does not block scraping, monetise content, or license content on a publisher's behalf —
it audits and reports on the public policy signals a site itself publishes. It does not provide
legal advice or a single recommended policy that fits every publisher; the right balance between
AI-search visibility and training-data exclusion is an editorial decision CrawlPact informs with
evidence, not one it makes. `robots.txt` and related signals are a publicly stated request, not an
enforcement mechanism — CrawlPact's reports describe what a site currently requests, not whether
every crawler will actually comply.

## Methodology and limitations

See [Methodology](/methodology) for the full description of what CrawlPact evaluates, and
[Limitations](/limitations) for what it deliberately does not claim.

## Frequently asked questions

**Can CrawlPact guarantee my content won't be used for AI training?** No. CrawlPact reports on the
public signals a site publishes requesting that outcome; it cannot guarantee any crawler's actual
compliance.

**Does CrawlPact distinguish search crawlers from training crawlers automatically?** Yes — the
crawler registry classifies each documented token by purpose, and audit findings are organised
around that distinction rather than treating "AI crawler" as one undifferentiated category.

**What plan fits a single publication?** Pro typically fits a single publisher's domain (weekly
monitoring, 24 months of history) — see the plan guidance above for current pricing and exact
limits.
