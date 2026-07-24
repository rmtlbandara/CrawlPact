# Product Scope

Quick-reference summary of `docs/product/CRAWLPACT_FINAL_SRS.md` §5. The SRS is authoritative;
this page exists so scope questions can be answered without opening the full document.

## CrawlPact is

A vendor-neutral public-website AI-crawler-policy auditor, monitor, `robots.txt` evaluator,
policy-conflict detector, crawler-purpose knowledge base, report generator, multi-domain
portfolio tool, technical recommendation system, and change-governance platform.

## CrawlPact is not

A WAF, reverse proxy, live crawler blocker, server-log analytics service, full-site SEO
crawler, AI-search ranking tracker, brand-mention tracker, legal service,
copyright-enforcement service, compliance certificate, or a guarantee of any kind about
external crawler behaviour or AI visibility outcomes.

## Prohibited claims (never ship copy that says this)

"Stop all AI scraping", "Guarantee protection from AI", "Make AI crawlers obey", "Ensure
ChatGPT ranking", "Legally protect your website content", "Complete AI compliance", "Block
every AI bot", "Guarantee AI visibility."

## Approved claims

"Audit your declared AI crawler policy", "See how documented crawlers are addressed", "Detect
crawler-policy conflicts", "Monitor crawler-policy changes", "Generate evidence-based
recommendations", "Compare search and training crawler access", "Manage crawler policies across
multiple websites."

## Current phase boundary (Part 1)

Part 1 builds the engineering foundation and public website shell only. It does not implement:
the scanner, authentication, monitoring, billing, or Super Admin — see
`docs/status/IMPLEMENTATION_STATUS.md` for what phase comes next.
