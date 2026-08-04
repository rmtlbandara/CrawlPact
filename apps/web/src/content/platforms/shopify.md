---
title: "AI crawler policy on Shopify"
description: "How Shopify's robots.txt.liquid customization mechanism works, its default rules, and its documented limits — verified against official Shopify documentation."
platformName: "Shopify"
platformCategory: "hosted_application"
summary: "Shopify serves a default robots.txt optimised for SEO and allows merchants to customise it via a robots.txt.liquid theme template with a deliberately limited set of Liquid objects — customisation is explicitly unsupported by Shopify Support."
officialSources:
  [
    {
      title: "Editing robots.txt.liquid",
      url: "https://help.shopify.com/en/manual/promoting-marketing/seo/editing-robots-txt",
    },
    {
      title: "Customize robots.txt",
      url: "https://shopify.dev/docs/storefronts/themes/seo/robots-txt",
    },
  ]
platformDocsVerifiedDate: "2026-08-04"
publishedDate: "2026-08-04"
relatedGuideSlugs: ["robots-txt-syntax-basics", "robots-txt-rule-not-blocking-a-crawler"]
relatedCrawlerSlugs: []
relatedPlatformSlugs: ["wordpress", "cloudflare"]
---

## What CrawlPact can verify

CrawlPact fetches your store's live, public `robots.txt` exactly as served — whether that's
Shopify's unmodified default, or your own customised `robots.txt.liquid` output — along with any
meta directives and relevant response headers.

## What CrawlPact cannot verify

CrawlPact cannot see your theme code editor or confirm whether a `robots.txt.liquid` file exists
in your theme's `templates` folder — only the resulting public `robots.txt` output. It also cannot
confirm Shopify's own internal crawling/indexing behaviour for admin, cart, or checkout paths
beyond what the published rules request.

## Where crawler policy may originate on Shopify

- **Shopify's default `robots.txt`** — served automatically with no merchant action required,
  already disallowing paths like `/admin`, `/cart`, `/checkout`, filtered collection URLs
  (`/collections/*+*`), `/search`, and `/policies/`.
- **A custom `robots.txt.liquid` file** — added by a merchant or developer to the active theme's
  `templates` folder via the code editor. This is the only way to customise Shopify's `robots.txt`;
  there is no dashboard setting for it.
- **Theme-level meta tags**, if a theme's own code adds them.

## Public signals relevant to Shopify

`robots.txt` (default or customised) and any meta directives a theme adds. Shopify's own
documentation does not describe a dashboard mechanism for setting sitewide meta robots tags
independent of theme code.

## Common conflicts or failure modes

- **Replacing the entire template with static text instead of extending the default groups.**
  Shopify's own developer documentation recommends looping through `robots.default_groups` and
  conditionally modifying them, specifically because Shopify updates its own default rules over
  time — a full plain-text replacement stops receiving those updates and can drift out of date.
- **An unsupported edit breaking crawler access entirely.** Shopify explicitly documents this as a
  real risk ("incorrect use of the feature can result in loss of all traffic") and states Shopify
  Support cannot assist with `robots.txt.liquid` edits.
- **Assuming a Liquid object is available that isn't.** The template supports exactly six objects
  (`robots`, `group`, `rule`, `user_agent`, `sitemap`, `request`) — attempting to reference
  anything else will not work as expected.
- **Multi-market/multi-domain stores** applying one set of rules globally when different markets
  or domains need different rules — `request.host` is available specifically to support
  host-specific logic for this case.

## How to inspect the current public response

Request `https://yourstore.myshopify.com/robots.txt` (or your custom domain's equivalent) directly
— this reflects Shopify's default rules combined with any customisation your theme's
`robots.txt.liquid` applies.

## How to implement or update policy safely

- To add a rule without losing Shopify's maintained defaults: create `robots.txt.liquid` in your
  theme's `templates` folder, loop through `robots.default_groups`, and conditionally add or skip
  specific directives rather than replacing the whole output.
- To block or allow a specific crawler by name: define an additional rule group outside the
  default loop, targeting that crawler's `user_agent` token specifically.
- Given Shopify's own "unsupported customization" warning, test any change on a duplicate/
  development theme before publishing it live, and confirm the resulting `robots.txt` is what you
  intended before switching your live theme.

## How to verify after deployment

Re-fetch `/robots.txt` immediately after publishing a theme change that touches
`robots.txt.liquid` — given Shopify's own stated risk of losing all organic traffic from an
incorrect edit, this is worth confirming directly rather than assuming the theme editor's preview
matches the live, published result.

## Monitoring and change detection

A saved CrawlPact domain is automatically rechecked on your plan's schedule (Solo: monthly,
Pro/Agency: weekly), which will catch a theme change (including a theme switch that removes or
alters a previously-customised `robots.txt.liquid`) without requiring a manual recheck.

## Platform-specific limitations

- CrawlPact cannot read your theme's `robots.txt.liquid` source — only the rendered, public
  output.
- CrawlPact cannot confirm which Shopify default rules are currently active versus overridden by
  your own customisation without directly comparing the fetched output to Shopify's documented
  defaults.
- Shopify Support does not assist with `robots.txt.liquid` customisation issues — CrawlPact's
  guidance here reflects Shopify's own published documentation, not a Shopify support channel.

## Related tools and crawler pages

See [robots.txt syntax basics](/guides/robots-txt-syntax-basics) for the underlying directive
rules Shopify's Liquid template ultimately generates, and the [crawler directory](/crawlers) for
documented AI crawler tokens to reference by name.

## Frequently asked questions

**Can I block AI training crawlers on Shopify without breaking SEO crawlers?** Yes, in principle —
add a rule group targeting the specific AI-training crawler's `user_agent` token while leaving
Shopify's default groups (which govern search-crawler-relevant paths) untouched. See
[Block only AI training crawlers](/guides/how-to-block-only-ai-training-crawlers) for the
platform-neutral directive pattern.

**Will Shopify support help me fix a robots.txt.liquid mistake?** Per Shopify's own documentation,
no — this is explicitly an unsupported customization.
