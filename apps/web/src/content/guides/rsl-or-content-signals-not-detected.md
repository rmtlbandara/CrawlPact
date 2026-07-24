---
title: "My RSL or Content Signals declaration isn't being detected — troubleshooting"
description: "Common causes when CrawlPact reports 'not found' for a published RSL declaration or Content-Signal header, and how to check each one."
category: "troubleshooting"
publishedDate: "2026-07-24"
---

Both RSL and Content Signals rely on the declaration being served exactly where and how
CrawlPact — and any AI crawler checking it — expects to find it.

## RSL: "No RSL license element was found"

CrawlPact fetches `/.well-known/rsl.xml` and specifically looks for a `<license` element in the
response body. Common causes:

- The file is published at a different path. It must be exactly `/.well-known/rsl.xml` at your
  domain root.
- The response is a redirect or error page rather than the actual XML content. Confirm
  `/.well-known/rsl.xml` returns a normal 200 response with your XML directly, not a redirect to
  a login page or a generic 404 page that happens to return status 200.
- The XML is present but doesn't contain a `<license>` element — CrawlPact's reader specifically
  requires this element to consider the declaration "discovered."

## Content Signals: "No Content-Signal response header was present"

CrawlPact checks the `Content-Signal` HTTP response header on your homepage request specifically.
Common causes:

- The header is set on some paths but not the homepage. CrawlPact currently checks the homepage
  response only.
- The header is being stripped by a CDN, proxy, or caching layer between your origin server and
  the internet. Test with a direct `curl -I` request against your live domain to confirm the
  header is actually present in the response CrawlPact (and any external crawler) would see.
- The header name or `key=value` syntax has a typo — CrawlPact parses comma-separated
  `key=value` pairs; a value it doesn't recognise as `yes` or `no` is reported as `unknown`
  rather than silently ignored.

## Verify

Run CrawlPact's [RSL validator](/tools/rsl-validator) or
[Content Signals checker](/tools/content-signals-checker) after making a change — both re-fetch
live on each scan.
