---
title: "robots.txt vs. meta robots tag vs. X-Robots-Tag: which mechanism to use"
description: "Three different mechanisms can restrict crawler access, at different scopes and for different content types. A decision guide for choosing between them."
category: "decision"
publishedDate: "2026-07-24"
---

Three separate, standard mechanisms can express a crawling or indexing restriction, and they
operate at different scopes. Using the wrong one for the job is a common source of confusion.

## The three mechanisms

- **`robots.txt`** — a single file at the domain root, declaring rules per crawler token, scoped
  by URL path pattern. It restricts _crawling_ (whether a page is fetched at all).
- **Meta robots tag** — an HTML `<meta name="robots" content="...">` tag on an individual page.
  It restricts _indexing/following_ of that specific page, but only takes effect if the crawler
  is actually allowed to fetch the page in the first place (a page disallowed in `robots.txt` is
  never fetched, so its meta tag is never seen).
- **`X-Robots-Tag`** — an HTTP response header, equivalent to the meta robots tag but usable on
  any response type, including non-HTML files (PDFs, images) where a `<meta>` tag isn't possible.

## The decision

- Use `robots.txt` to prevent a crawler from fetching a section of your site at all — this is the
  only mechanism of the three that stops the request itself.
- Use the meta robots tag when you want a page to be fetched (so its content can still be
  evaluated) but not indexed or followed from — for example, a private-but-linked page.
- Use `X-Robots-Tag` for the same per-page control as the meta robots tag, but on a file type
  that can't carry an HTML `<meta>` tag, or when you want to set the directive at the server/CDN
  level rather than in every page's HTML.

## Common mistake CrawlPact flags

Adding a meta robots or `X-Robots-Tag` "noindex" directive to a page that's also disallowed in
`robots.txt` for the same crawler is redundant, and can create a false sense of double protection
— since the crawler never reaches the page to see the tag at all. CrawlPact's
[Content Signals checker](/tools/content-signals-checker) surfaces the meta robots tag,
`X-Robots-Tag` header, and canonical URL together, alongside the `robots.txt` result, so you can
see whether they actually agree.
