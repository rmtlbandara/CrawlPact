---
title: "My llms.txt file isn't validating — troubleshooting"
description: "Common structural issues CrawlPact's llms.txt validator flags, and how to fix each one."
category: "troubleshooting"
publishedDate: "2026-07-24"
---

CrawlPact's [llms.txt validator](/tools/llms-txt-validator) checks a small set of structural
properties. Here's what each issue means.

## "No top-level Markdown heading found near the start of the file"

The validator looks for a line starting with `# ` (a single `#`, a space, then text) within the
first five lines of the file. A file that starts with plain text, an H2 (`##`), or a heading
further down the file will trigger this. Fix: add `# Your Site Name` as the very first
substantive line.

## "The file is empty"

The file exists (CrawlPact received a response) but has no content. Fix: add actual content, or
remove the file entirely if you don't intend to publish one — an absent `llms.txt` is treated as
informational, not an error.

## No linked resources detected

The validator counts Markdown links in the form `[label](url)`. If your file describes resources
in plain text or a different format, they won't be counted as linked resources. Fix: use standard
Markdown link syntax for anything you want recognised as a linked resource.

## The file returns a non-2xx status code

If your server returns an error status (404, 500, or similar) for `/llms.txt`, CrawlPact reports
it as not found, the same as if the file didn't exist. Confirm the file is actually deployed at
the domain root and returns a normal 200 response.

## Checking llms-full.txt separately

`/llms.txt` and `/llms-full.txt` are checked and reported independently — an issue with one
doesn't imply an issue with the other, and you don't need to publish both.

See [How to publish an llms.txt file](/guides/how-to-publish-an-llms-txt-file) for the full
step-by-step guide.
