---
title: "AI crawler policy on WordPress"
description: "How WordPress's virtual robots.txt, the 'Discourage search engines' setting, and theme/plugin interactions affect what your site tells AI crawlers — verified against official WordPress documentation."
platformName: "WordPress"
platformCategory: "hosted_application"
summary: "WordPress core generates a virtual robots.txt when no physical file exists, and its 'Discourage search engines from indexing this site' setting behaves differently depending on WordPress version — a meta tag today, a robots.txt change in versions before 5.3."
officialSources:
  [
    {
      title: "Settings Reading screen",
      url: "https://wordpress.org/documentation/article/settings-reading-screen/",
    },
    {
      title: "do_robots() — Function",
      url: "https://developer.wordpress.org/reference/functions/do_robots/",
    },
  ]
platformDocsVerifiedDate: "2026-08-04"
publishedDate: "2026-08-04"
relatedGuideSlugs: ["robots-txt-syntax-basics", "robots-txt-vs-meta-robots-vs-x-robots-tag"]
relatedCrawlerSlugs: []
relatedPlatformSlugs: ["cloudflare", "shopify"]
---

## What CrawlPact can verify

CrawlPact fetches your site's actual public `robots.txt` (physical or WordPress's own generated
virtual one), meta robots tags in the rendered page `<head>`, and relevant response headers — the
same content any real crawler receives, regardless of which mechanism produced it.

## What CrawlPact cannot verify

CrawlPact cannot see your WordPress admin settings directly (whether "Discourage search engines"
is checked, which plugins are active, or your theme's own header modifications) — only the
resulting public output. It also cannot determine which specific plugin or theme caused a given
directive to appear if multiple are capable of modifying `robots.txt`/meta tags on your site.

## Where crawler policy may originate on WordPress

- **A physical `robots.txt` file** uploaded to the site root — if one exists, it takes precedence
  over WordPress's own generated version entirely.
- **WordPress core's virtual `robots.txt`** — generated dynamically by the `do_robots()` function
  when no physical file exists; by default this disallows `/wp-admin/` while explicitly allowing
  `/wp-admin/admin-ajax.php`, then applies the `robots_txt` filter (which any theme or plugin can
  hook into to add further rules).
- **The "Discourage search engines from indexing this site" setting** (Settings → Reading) —
  since WordPress 5.3, checking this generates a page-level `<meta name="robots"
content="noindex,nofollow" />` tag. In versions before 5.2, the same setting instead changed the
  virtual `robots.txt` output to `User-agent: * / Disallow: /` — but only when WordPress is
  installed in the site root and no physical `robots.txt` file already exists.
- **SEO plugins** (e.g. those managing sitemaps/meta tags) — a common source of additional meta
  robots or header directives, distinct from WordPress core's own behaviour.
- **A hosting platform or CDN** in front of WordPress, which can add its own headers or modify the
  response independently of WordPress itself — see the [Cloudflare guide](/platforms/cloudflare)
  if applicable.

## Public signals relevant to WordPress

`robots.txt` (physical file, or core's virtual one), the page-level meta robots tag WordPress's
"Discourage search engines" setting can add, and any additional directives a theme, plugin, or
hosting layer introduces.

## Common conflicts or failure modes

- **A physical `robots.txt` file silently overriding the virtual one.** If a site owner (or an
  old plugin, or a migration) left a static `robots.txt` file in the site root, WordPress's own
  dynamic generation — including anything the `robots_txt` filter would otherwise add — never
  runs at all.
- **Confusing "Discourage search engines" with actually blocking crawlers.** Per WordPress's own
  documentation, this setting's effect (a `noindex` meta tag on current versions) does not block
  access at a technical level, and most search engines honour it voluntarily rather than being
  forced to — content already indexed before the setting was enabled is not automatically removed.
- **Multiple plugins independently modifying `robots.txt` or meta directives**, producing
  conflicting or duplicated rules that aren't obvious from checking any single plugin's own
  settings screen in isolation.
- **A staging or migrated site inheriting "Discourage search engines" as checked**, silently
  suppressing indexing (via the noindex meta tag) after going live, if the setting wasn't
  explicitly reviewed as part of the launch process.

## How to inspect the current public response

Request `https://yourdomain.com/robots.txt` directly, and view the page source of a live page to
check for a `noindex` meta tag in `<head>` — both are simple, direct checks that reflect the same
final output any crawler receives, regardless of which WordPress mechanism produced them.

## How to implement or update policy safely

- To set explicit rules beyond WordPress's default virtual output: create a physical
  `robots.txt` file in the site root (this fully replaces the virtual one — the `robots_txt`
  filter no longer applies once a physical file exists).
- To hook into the default output instead of fully replacing it: use the `robots_txt` filter (a
  developer-level change, typically via a plugin or theme's `functions.php`) so WordPress's own
  baseline rules (like disallowing `/wp-admin/` while allowing AJAX) are preserved.
- Always confirm "Discourage search engines from indexing this site" (Settings → Reading) is
  unchecked before launching a production site, if broad indexability is intended — this is a
  frequent, easy-to-miss cause of an entire site being marked `noindex`.

## How to verify after deployment

Re-check both `/robots.txt` and a live page's meta tags after any plugin, theme, or hosting change
— and specifically after any site migration or launch, given how common the "Discourage search
engines" setting is as a source of an unintended sitewide `noindex`.

## Monitoring and change detection

A saved CrawlPact domain is automatically rechecked on your plan's schedule (Solo: monthly,
Pro/Agency: weekly) — this will catch a plugin update, theme change, or an accidentally-toggled
"Discourage search engines" setting without requiring a manual recheck.

## Platform-specific limitations

- CrawlPact cannot identify which specific WordPress plugin or theme is responsible for a given
  directive — only that the directive is present in the public output.
- CrawlPact cannot read the WordPress admin "Discourage search engines" checkbox state directly;
  it can only observe the resulting meta tag or `robots.txt` output.
- Behaviour of the "Discourage search engines" setting differs by WordPress core version (noindex
  meta vs. `robots.txt` change) — CrawlPact reports the actual output your site currently produces,
  not which mechanism produced it.

## Related tools and crawler pages

See [robots.txt vs. meta robots vs. X-Robots-Tag](/guides/robots-txt-vs-meta-robots-vs-x-robots-tag)
for how these three signal layers relate, and the [crawler directory](/crawlers) for documented
AI crawler tokens.

## Frequently asked questions

**Does checking "Discourage search engines" block AI training crawlers specifically?** On current
WordPress versions it adds a sitewide `noindex` meta tag — a broad signal, not one that
distinguishes search from AI-training crawlers. For that distinction, see
[Block only AI training crawlers](/guides/how-to-block-only-ai-training-crawlers).

**Does CrawlPact edit my WordPress site?** No — CrawlPact audits the public `robots.txt` and meta
signals your site already produces; changing WordPress settings, themes, or plugins happens in
your own WordPress admin.
