---
title: "A crawler shows 'Resource unavailable' — troubleshooting"
description: "What it means when CrawlPact can't determine a crawler's access result because robots.txt itself couldn't be fetched, and how to fix it."
category: "troubleshooting"
publishedDate: "2026-07-24"
---

"Resource unavailable" means CrawlPact could not evaluate a crawler's access at all, because the
underlying `robots.txt` fetch didn't succeed — it is not the same as "no explicit rule" or
"allowed," both of which require a readable `robots.txt`.

## Check your scan's overall status first

- **`incomplete`** — the `robots.txt` request was attempted but didn't complete (DNS failure,
  connection refused, timeout, or a similar network-level issue).
- **`target_unavailable`** — the request was refused before being attempted, because the target
  failed CrawlPact's own safety validation (for example, it resolved to a private or reserved IP
  address).

## Common causes

1. **DNS doesn't resolve.** Confirm the domain resolves publicly — a domain that only resolves on
   an internal network can't be reached by CrawlPact's scanner or by any external crawler either.
2. **The server is unreachable or times out.** A slow or down server will fail the same way for
   CrawlPact and for real crawlers.
3. **A firewall or bot-protection service blocks the request.** Some services block automated
   requests by default, including CrawlPact's scanner and legitimate AI crawlers.
4. **The target resolves to a private, loopback, or otherwise unsafe address.** CrawlPact's
   safe-fetch chokepoint refuses these outright, for the same reason a legitimate crawler
   operator's own infrastructure would.

## What this means for your actual crawler policy

If `robots.txt` can't be fetched, real crawlers face the same situation CrawlPact did — they
either treat the site as having no accessible `robots.txt` (commonly interpreted as unrestricted)
or decline to crawl at all, depending on the operator's own behaviour, which CrawlPact cannot
observe or guarantee.

## Verify once fixed

Re-run the scan via CrawlPact's [AI crawler checker](/tools/ai-crawler-checker) once the
underlying reachability issue is resolved.
