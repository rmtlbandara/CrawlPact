---
title: "My Policy Health Score dropped between scans — troubleshooting"
description: "What causes a saved domain's score to change on a scheduled re-scan, and how to find exactly what changed."
category: "troubleshooting"
publishedDate: "2026-07-24"
---

A score change between two scans of the same domain always has a specific, traceable cause —
CrawlPact never adjusts a score without a detected change in what was actually declared.

## Check what actually changed first

Every saved domain's history timeline records each scan and highlights detected differences from
the previous one. Before assuming something is wrong, check whether the change was intentional —
a deployment, a CDN configuration change, or a plugin update can all alter `robots.txt` or other
policy files without anyone directly editing them.

## Common real causes

1. **A `robots.txt` rule changed.** A new `Disallow` line, a removed `Allow` line, or a rewritten
   wildcard group can all shift which crawlers are evaluated as allowed or blocked.
2. **The registry changed, not your website.** If a crawler's purpose classification or lifecycle
   status was updated in CrawlPact's registry (for example, a crawler moving from `unverified` to
   `active`, or being marked `deprecated` with a replacement), your score can change even though
   your `robots.txt` file is byte-for-byte identical. CrawlPact's registry changelog records
   exactly this kind of change, separately from any change to a scanned website — see
   [changelog](/changelog).
3. **A new finding was introduced.** A change that creates a new conflict (for example, a broad
   wildcard rule newly overriding a specific one) lowers the score even if the specific line that
   changed looks minor.
4. **The scan was incomplete.** A scan that couldn't fully reach your site (see
   [Resource unavailable troubleshooting](/guides/crawler-shows-resource-unavailable)) is scored
   differently from a fully completed one, since an incomplete result reflects missing
   information, not a confirmed policy state.

## Verify with evidence

Every finding CrawlPact reports includes the specific evidence behind it — the matched
`robots.txt` line, the affected crawler, and the ruleset version used to evaluate it. Compare two
scans' full reports side by side rather than relying on the score number alone.
