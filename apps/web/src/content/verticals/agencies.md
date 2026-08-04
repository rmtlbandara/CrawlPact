---
title: "AI crawler policy for agencies"
description: "Audit, explain, and monitor AI crawler policy across every client website from one place — evidence-backed, without exposing internal tooling to clients."
audience: "Agencies"
primaryProblem: "Agencies must understand, explain, and monitor AI crawler policy state across many client websites at once — one-off manual checks don't scale, and clients ask about it in language that doesn't map cleanly to a robots.txt file."
recommendedPlan: "agency"
relatedPlatformSlugs: ["cloudflare", "wordpress", "shopify", "vercel", "netlify"]
relatedGuideSlugs:
  [
    "blocking-ai-training-while-staying-visible-in-ai-search",
    "how-to-block-only-ai-training-crawlers",
    "robots-txt-rule-not-blocking-a-crawler",
  ]
publishedDate: "2026-08-04"
---

## Why this is different for an agency

A single client's crawler policy is a one-time question. A portfolio of client sites is a
recurring one — hosting changes, theme updates, and CDN migrations all touch `robots.txt` and
related public signals without anyone necessarily deciding to change AI crawler access. An agency
finds out about a policy drift when a client asks why their site suddenly (or has always) blocked
a crawler they expected to allow, or vice versa — usually after the fact, not before.

## Portfolio workflow

CrawlPact's saved-domain model is built around exactly this shape of work:

1. **Audit** each client domain — a full, source-cited evaluation of what the site currently tells
   search, training, retrieval, and agent crawlers, run the same way regardless of plan.
2. **Establish a baseline** — the audited state becomes the reference point for future change
   detection.
3. **Identify conflicts and unspecified rules** — where a robots.txt rule, meta directive, and
   header disagree, or where a crawler's access simply isn't addressed at all.
4. **Apply client-approved recommendations** — CrawlPact surfaces findings and evidence; what to
   change is always the client's and agency's decision, never an automated action CrawlPact takes
   on their behalf.
5. **Monitor** — scheduled rechecks detect both a change to the website's own configuration and a
   change to CrawlPact's verified crawler registry (e.g. a new documented AI crawler token).
6. **Share or export evidence** — a private, revocable report link, or a CSV export for a client
   deliverable.

## Client communication and evidence

Every report includes the evidence CrawlPact based its findings on — the actual fetched
`robots.txt`/meta/header content, not just a pass/fail summary — so an agency can show a client
exactly what was found, not just assert a conclusion. Reports can be shared via a private,
revocable link (never publicly indexable) and, on the Agency plan, carry the agency's own name and
logo — CrawlPact's own methodology and limitations disclosure always remains visible on a shared
report; branding never replaces or hides it.

## Monitoring and registry changes

Automatic monitoring frequency depends on plan (Solo: monthly, Pro/Agency: weekly — see the plan
guidance below). A monitoring cycle checks for two distinct kinds of change: the website's own
published policy changing, and CrawlPact's own verified crawler registry changing (a new crawler
being added, or an existing one's classification being corrected against its operator's
documentation) — either can affect what a previously-audited site is now effectively telling
crawlers, even with zero changes on the client's side.

## Current Agency-plan capabilities

- **100 saved domains**, weekly automatic monitoring, 36 months of audit-history retention.
- **Domain groups** — organise saved domains (e.g. by client) rather than one flat list.
- **CSV export** and **batch import** (up to 100 domains at once) for onboarding or reporting a
  portfolio.
- **Agency-branded shared reports** — the only plan tier with this capability.
- **10 manual re-scans per domain per month**, beyond the scheduled automatic monitoring.

Every plan — including Free — gets the identical, complete audit; nothing about the underlying
analysis is gated or degraded by plan. What scales with plan is how many domains you can save, how
often they're automatically rechecked, how long history is kept, and export/sharing capacity.

## What this does not include

CrawlPact does not provide a client-facing portal, per-seat team roles, an automated
cross-domain comparison dashboard, or domain-ownership verification — an agency account is a
single login managing its own saved domains, and any of the above would be a distinct future
capability, not something currently built. CrawlPact also does not offer daily or real-time
monitoring on any plan today; the fastest current automatic cadence is weekly.

## Methodology and trust

CrawlPact audits and monitors the public policy signals a website publishes — it does not control
external crawlers or guarantee that any of them will comply with what a site declares. See
[Methodology](/methodology) for exactly what CrawlPact evaluates and how, and
[Scoring](/scoring) for how findings are weighted into a result.

## Frequently asked questions

**Does CrawlPact make changes to a client's website?** No. CrawlPact reads publicly accessible
policy signals and reports on them; applying any recommended change is always a separate, manual
step the agency or client takes.

**Can I white-label the entire product for clients?** Agency-plan shared reports carry your
agency's name and logo. CrawlPact's own methodology and limitations disclosure stays visible on
every shared report — it is not removable, since a report's credibility depends on that
disclosure being present.

**How many client domains can I monitor?** Up to 100 on the Agency plan, with weekly automatic
monitoring for each — see the plan guidance above for current pricing.
