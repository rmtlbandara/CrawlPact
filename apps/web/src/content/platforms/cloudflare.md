---
title: "AI crawler policy on Cloudflare"
description: "How Cloudflare's managed robots.txt and AI Crawl Control interact with your site's public AI crawler policy — verified against official Cloudflare documentation."
platformName: "Cloudflare"
platformCategory: "managed_cdn"
summary: "Cloudflare sits in front of many sites as a CDN/edge layer and offers two AI-crawler-relevant features: an optional managed robots.txt that adds AI-crawler-blocking rules, and AI Crawl Control, a monitoring/permission layer for AI crawler access."
officialSources:
  [
    {
      title: "Managed robots.txt",
      url: "https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/",
    },
    {
      title: "AI Crawl Control overview",
      url: "https://developers.cloudflare.com/ai-crawl-control/",
    },
  ]
platformDocsVerifiedDate: "2026-08-04"
publishedDate: "2026-08-04"
relatedGuideSlugs:
  [
    "how-to-block-only-ai-training-crawlers",
    "blocking-ai-training-while-staying-visible-in-ai-search",
  ]
relatedCrawlerSlugs: []
relatedPlatformSlugs: ["wordpress", "shopify", "vercel", "netlify"]
---

## What CrawlPact can verify

CrawlPact fetches the live, public `robots.txt`, meta directives, and relevant response headers
for your domain exactly as a real crawler would receive them — including whatever Cloudflare adds
or modifies in front of your origin. If Cloudflare's managed robots.txt is enabled, CrawlPact's
audit will see the combined result (Cloudflare's managed rules plus your own, if you have an
existing file), not just what your origin server alone would return.

## What CrawlPact cannot verify

CrawlPact cannot see your Cloudflare dashboard configuration directly (whether managed robots.txt
or AI Crawl Control is enabled, or which per-crawler rules you've set) — only the public result
those settings produce. It also cannot verify Cloudflare's own internal enforcement of AI Crawl
Control's allow/block rules (i.e., whether Cloudflare is actually blocking a crawler at the edge)
— that is a Cloudflare platform capability CrawlPact does not have visibility into; CrawlPact
audits publicly declared policy signals, not edge-level enforcement logs.

## Where crawler policy may originate on Cloudflare

- **Your origin server's own `robots.txt`** — unaffected by Cloudflare unless managed robots.txt
  is enabled.
- **Cloudflare's managed robots.txt** (optional, Security Settings → Bot traffic) — if your domain
  has no `robots.txt`, Cloudflare creates one with managed `Disallow` rules for known AI crawlers;
  if you already have one (verified by an HTTP 200 response), Cloudflare prepends its managed
  rules before your existing file, combining both into a single response.
- **AI Crawl Control** — a separate feature for per-crawler allow/block rules and robots.txt
  compliance tracking (which crawlers request paths your `robots.txt` disallows).
- **Response headers** set at your origin, or via Cloudflare Workers/Transform Rules, if you use
  them.

## Public signals relevant to Cloudflare

`robots.txt` (potentially combined, as above), meta robots tags (unaffected by Cloudflare unless
you specifically modify them at the edge), and response headers. Cloudflare's managed robots.txt
also emits a `Content-signal` directive (per Cloudflare's Content Signals format) alongside the
`Disallow` rules for named AI crawlers.

## Common conflicts or failure modes

- **Assuming your own `robots.txt` is the only thing being served.** If managed robots.txt is
  enabled, the public response is your file _plus_ Cloudflare's prepended rules — not your file
  alone. An audit run before verifying this combination can look inconsistent with what you
  expected to publish.
- **Google Search Console flagging Cloudflare's `Content-signal` line as unrecognised syntax.**
  Cloudflare's own documentation notes this is expected and, per their reporting, has shown no
  observed impact on crawl rate or search visibility — but it can look alarming in a Search
  Console report if you don't know to expect it.
- **Assuming AI Crawl Control's allow/block rules alone are sufficient**, without also checking
  the resulting public `robots.txt` — the two are related but distinct: one is dashboard
  configuration, the other is what's actually published for any crawler (including ones that
  simply respect robots.txt directives rather than being individually rate-limited or blocked by
  Cloudflare) to see.

## How to inspect the current public response

Request `https://yourdomain.com/robots.txt` directly (a browser, `curl`, or CrawlPact's own audit)
— this is the authoritative check, since it reflects whatever Cloudflare has combined with your
origin's own file, not just what you have configured at either layer individually.

## How to implement or update policy safely

- To rely on Cloudflare's managed rules: enable managed robots.txt in Security Settings → Bot
  traffic — no origin-side change is required, and Cloudflare states it will keep the managed
  rules current as the AI crawler landscape changes.
- To set your own rules instead or in addition: edit your origin's `robots.txt` directly — if
  managed robots.txt is also enabled, expect Cloudflare's rules to appear first in the combined
  response.
- For per-crawler allow/block decisions beyond what robots.txt alone expresses: configure AI Crawl
  Control's rules for the specific crawler.

## How to verify after deployment

Re-fetch `/robots.txt` (or re-run a CrawlPact audit) after any change to either your origin file or
your Cloudflare dashboard settings — the combination is what matters, and only checking one side
can miss a change on the other.

## Monitoring and change detection

A saved CrawlPact domain is automatically rechecked on your plan's schedule (Solo: monthly,
Pro/Agency: weekly), which will catch a change to either your origin's `robots.txt` or Cloudflare's
managed rules, without you needing to remember to manually recheck after a dashboard change.

## Platform-specific limitations

- CrawlPact cannot confirm whether AI Crawl Control's per-crawler blocking is actually being
  enforced at Cloudflare's edge — only what the public response signals request.
- CrawlPact cannot read your Cloudflare dashboard configuration directly; findings are always
  based on the public, fetched result.
- Cloudflare's pay-per-crawl monetisation feature is, per Cloudflare's own documentation, in
  private beta — CrawlPact does not have specific guidance on it beyond what Cloudflare has
  published.

## Related tools and crawler pages

See the [crawler directory](/crawlers) for documented AI crawler tokens, and
[Block only AI training crawlers](/guides/how-to-block-only-ai-training-crawlers) for a
platform-neutral rule-writing guide.

## Frequently asked questions

**Does CrawlPact configure Cloudflare for me?** No — CrawlPact audits and reports on the public
result; enabling or changing Cloudflare's managed robots.txt or AI Crawl Control settings happens
in your own Cloudflare dashboard.

**Will CrawlPact tell me if Cloudflare's managed robots.txt is on?** CrawlPact reports what's
publicly visible in the combined `robots.txt` response — if Cloudflare's managed rules are present,
they'll appear in the fetched content the same way your own rules do.
