---
title: "How to publish an llms.txt file"
description: "A step-by-step implementation guide for adding a valid llms.txt (and llms-full.txt) file to your site."
category: "implementation"
publishedDate: "2026-07-24"
---

`llms.txt` is a community-proposed convention (not an IETF or W3C standard) for giving AI systems
a concise, structured entry point to a site's most relevant content, in Markdown.

## Step 1: Create the file at your domain root

Place a plain-text file at `/llms.txt` — for example `https://example.com/llms.txt`. Where that
file physically lives depends on your hosting:

- **Static-site hosts** (Cloudflare Pages/Workers Assets, Netlify, Vercel, or any static-site
  generator, including this site) — put the file in the project's static-assets directory (often
  named `public/`), so it's copied to the site root unchanged at build time, alongside files like
  `robots.txt` and `favicon.ico`.
- **WordPress** — a real file placed directly in the site's web root (via SFTP or your host's file
  manager) is served as-is; Apache and Nginx check for a matching file on disk before handing the
  request to WordPress's own routing, so no plugin is required if you have direct file access. If
  your host doesn't allow that, a small plugin (or a `functions.php` snippet hooked to WordPress's
  `init` action, matching the request path and outputting the content with a `text/plain`
  content-type) can serve it instead — the same technique WordPress itself uses to serve a virtual
  `robots.txt` when no physical file exists.

## Step 2: Start with a top-level Markdown heading

```markdown
# Example Site
```

A top-level `#` heading near the start of the file is the structural convention this format is
built around — CrawlPact's [llms.txt validator](/tools/llms-txt-validator) specifically checks
for its presence, since its absence is the most common structural issue.

## Step 3: Add links to your most relevant resources

```markdown
# Example Site

> A one-line summary of what this site is.

## Documentation

- [Getting started](/docs/getting-started)
- [API reference](/docs/api)
```

Each Markdown link (`[label](url)`) is a linked resource an AI system reading this file can
follow. Keep the list focused — this file is meant to be a concise entry point, not a full
sitemap.

## Step 4 (optional): Publish a longer llms-full.txt

Some sites also publish `/llms-full.txt` — the same convention, but with more complete content
inlined rather than just linked, for systems that prefer a single larger fetch over following
multiple links.

## Step 5: Verify

Run CrawlPact's [llms.txt validator](/tools/llms-txt-validator). It reports the file's size,
whether a top-level heading was found, and how many linked resources were detected, for both
`/llms.txt` and `/llms-full.txt` independently.

## What this doesn't do

Publishing `llms.txt` is informational — it does not control crawler access (that's
`robots.txt`'s role) and there is no guarantee any specific AI system reads or prioritises it, since
adoption of this convention varies by operator.
