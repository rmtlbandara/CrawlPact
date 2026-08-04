---
title: "AI crawler policy for SaaS and documentation teams"
description: "Audit and monitor AI crawler access to your product documentation, knowledge base, and marketing domains — including what deployment platforms change without you asking."
audience: "SaaS and documentation teams"
primaryProblem: "Documentation discoverability decisions, the search-versus-training distinction, and deployment-platform-driven policy drift all intersect on the domains SaaS teams run — often across multiple subdomains with different owners."
recommendedPlan: "pro"
relatedPlatformSlugs: ["vercel", "netlify", "cloudflare"]
relatedGuideSlugs:
  [
    "how-to-publish-an-llms-txt-file",
    "llms-txt-not-validating",
    "robots-txt-vs-meta-robots-vs-x-robots-tag",
  ]
publishedDate: "2026-08-04"
---

## Why this matters for SaaS and documentation

Product documentation and developer-facing content is exactly the kind of material AI search and
retrieval crawlers request most — a reader (or an AI agent acting for one) looking up how an API
works is a core discoverability case teams generally want to support. At the same time, some teams
want to separately consider whether the same content should be available for AI model training.
That's a real decision to make deliberately, not a default that happens to fall out of whatever a
docs platform ships by default.

## Documentation discoverability risk

A documentation site is frequently a separate subdomain or deployment from the main marketing
site — `docs.example.com`, a dedicated Vercel/Netlify project, or a self-hosted static-site
generator — each with its own `robots.txt` (or none at all, inheriting a platform default). It's
easy for the documentation subdomain's crawler policy to drift from what the main site intends,
simply because it's a separately deployed artifact nobody is auditing as a pair.

## Deployment and CDN drift

Static-site generators, documentation platforms, and CDNs can generate or modify `robots.txt` and
related headers automatically — a deploy-preview environment, a platform default, or a caching
layer can each independently affect what's actually served, separate from what's committed in a
repository. See the platform guides linked below for specifics on Vercel, Netlify, and Cloudflare.

## Audit workflow

CrawlPact fetches and evaluates the live, public response for a domain — not what a config file
_should_ produce, but what it actually does — and reports findings with the fetched evidence
attached, so a discrepancy between intended and deployed policy is something you can verify
directly, not just take on faith.

## Monitoring workflow

Automatic monitoring (Solo: monthly, Pro/Agency: weekly) rechecks a saved domain on a schedule and
flags a change — including a change caused entirely by a redeploy or a platform-side update, with
no commit to your own repository. A private Atom feed (Solo and above) lets a team subscribe to
these change alerts in whatever feed reader or automation already consumes Atom.

## Evidence and reporting

Reports can be shared via a private, revocable link — useful for looping in whichever team (docs,
platform, security) owns the affected subdomain without publishing the finding externally. CSV
export (Pro and above) and domain groups (Pro and above) support tracking documentation domains
alongside marketing/product domains as a coherent set.

## Current plan capabilities relevant here

- Saved domains: 5 (Solo) to 100 (Agency) — enough for a documentation subdomain plus the domains
  it's grouped with.
- Domain groups and CSV export: Pro and above.
- History retention: 12 months (Solo) to 36 months (Agency).
- Every plan gets the same complete audit — plan differences are about scale (how many domains,
  how often rechecked, how much history), never about audit accuracy.

## What CrawlPact does not do

CrawlPact does not improve search or AI-citation ranking automatically, does not guarantee AI
citation, does not manage or edit documentation content, and does not deploy policy fixes on a
team's behalf — it audits and monitors the public policy signals a domain already publishes.
CrawlPact also does not claim native, first-party integrations with every documentation platform;
the [platform guides](/platforms) describe what's independently verifiable about each platform's
public behaviour, not a built integration.

## Methodology

See [Methodology](/methodology) for what CrawlPact evaluates and [Limitations](/limitations) for
what it deliberately does not claim.

## Frequently asked questions

**Does CrawlPact see my documentation's actual content?** CrawlPact evaluates publicly accessible
policy signals (robots.txt, meta directives, relevant headers) — it does not index or store your
documentation's page content.

**Will CrawlPact catch a change made by my hosting platform, not my own commit?** Yes — monitoring
rechecks the live, deployed response, so a platform-side change is detected the same way a
self-authored one is.

**What plan fits a small documentation team with a couple of related domains?** Pro typically fits
(25 saved domains, weekly monitoring, domain groups) — see the plan guidance above for current
pricing.
