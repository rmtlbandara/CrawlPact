---
title: "How to publish an RSL (Really Simple Licensing) declaration"
description: "A step-by-step implementation guide for declaring permitted and prohibited AI uses of your content via RSL."
category: "implementation"
publishedDate: "2026-07-24"
---

RSL (Really Simple Licensing) is an emerging, XML-based specification for declaring what a
website's content may and may not be used for — including AI training — in a machine-readable
form. It is a declaration, not technical enforcement.

## Step 1: Create the file at the well-known RSL location

Place an XML file at `/.well-known/rsl.xml` — for example
`https://example.com/.well-known/rsl.xml`.

## Step 2: Declare a license element

```xml
<license>
  <permits>search</permits>
  <prohibits>train</prohibits>
</license>
```

CrawlPact's RSL reader recognises the `<license>`, `<permits>`, `<prohibits>`, `<payment>`, and
`<copyright>` elements. Anything else encountered is preserved and reported as an "unsupported
element" rather than silently discarded, since RSL is still an evolving specification.

## Step 3 (optional): Declare payment terms

```xml
<license>
  <permits>search</permits>
  <prohibits>train</prohibits>
  <payment>subscription</payment>
</license>
```

## Step 4: Verify

Run CrawlPact's [RSL validator](/tools/rsl-validator). It reports whether a `<license>` element
was discovered, and lists the declared permits, prohibits, and payment terms.

## Keep it consistent with your other declarations

If you also publish a `Content-Signal` header or specific `robots.txt` rules, make sure they say
the same thing — see
[RSL vs. Content Signals vs. robots.txt](/guides/rsl-vs-content-signals-vs-robots-txt) for why
nothing reconciles a disagreement between them automatically.

## What this doesn't do

RSL is a machine-readable declaration, not technical enforcement — see
[/limitations](/limitations). There is no guarantee that any specific crawler operator checks
this file, since RSL adoption varies.
