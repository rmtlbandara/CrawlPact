---
title: "My robots.txt rule isn't blocking a crawler — troubleshooting"
description: "Common causes when a Disallow rule doesn't appear to take effect against a specific AI crawler, and how to check each one."
category: "troubleshooting"
publishedDate: "2026-07-24"
---

A `Disallow` rule that appears correct but doesn't show as "Blocked" for a crawler usually comes
down to one of a small number of causes.

## 1. The token doesn't match exactly

`robots.txt` matches a crawler's token against `User-agent` lines by exact, case-insensitive
string — not by partial match or vendor name. `User-agent: OpenAI` does not match `GPTBot`.
Confirm the exact token via CrawlPact's [crawler directory](/crawlers).

## 2. A more specific rule elsewhere wins

The most specific matching path rule wins, not the first or last rule in the file. If
`Disallow: /` and `Allow: /blog` both exist in the same applicable group, a request for
`/blog/post` matches the more specific `/blog` rule and is allowed, even though a broader
`Disallow: /` also exists.

## 3. The rule is in the wrong group

`robots.txt` groups match a crawler by its exact token first; only if no group names that exact
token does the crawler fall back to a wildcard (`User-agent: *`) group. A `Disallow` rule placed
inside a group for a different, unrelated token has no effect on your target crawler.

## 4. Duplicate groups for the same token

If the same token appears in more than one `User-agent` group, the rules from all of them are
combined (RFC 9309 §2.2.1) rather than only the first group applying. CrawlPact's parser flags
this as a `DUPLICATE_GROUP` issue — check your scan's evidence for this warning.

## 5. The crawler doesn't obey robots.txt at all

`robots.txt` is a declared instruction. CrawlPact's evaluation reflects what your file says, not
a guarantee about a crawler's actual behaviour — see [/limitations](/limitations).

## Verify with evidence

CrawlPact's [robots.txt AI validator](/tools/robots-txt-ai-validator) shows the exact matched
rule and line number for each crawler, so you can see precisely which line produced the result
you're seeing.
