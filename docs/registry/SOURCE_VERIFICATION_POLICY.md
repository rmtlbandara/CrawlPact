# Source Verification Policy

## Standard

Every crawler record cites `official_source_url` pointing at documentation published by the
crawler's own operator (not a third-party aggregator). The seed data
(`packages/database/seed/seed.sql`) and content collection
(`apps/web/src/content/crawlers/*.md`) were re-verified by live-fetching each cited
`official_source_url` on 2026-07-24, closing the gap between the registry and the content
collection (22 of 23 registry crawlers now have a public page, corrected from a prior stale
"20 of 21" count — Phase 1, 2026-08-03; see the Bingbot exception below).
Two stale citations were found and corrected during this pass: OpenAI's crawler documentation
moved from `platform.openai.com/docs/bots` to `developers.openai.com/api/docs/bots`, and
Anthropic's moved from `support.anthropic.com/...` to `support.claude.com/...` (same article,
new host). Both records now cite the current URL.

While re-verifying OpenAI's and Google's crawler documentation, three real, operator-documented
crawlers not previously in the registry were found and added (registry release 2026.07.3):
`OAI-AdsBot` (OpenAI, ad-safety validation), `Google-CloudVertexBot` (Google, site-owner-requested
crawls for building Vertex AI Agents), and `GoogleOther` (Google, a generic crawler whose exact
purpose Google's own documentation deliberately does not specify — recorded as `unknown`, not
guessed). This also closes SRS §30.4's "20 crawler-reference pages" launch minimum with real,
individually-verified pages rather than an arbitrary count.

**Bingbot exception**: `crw_bingbot` remains in the registry (seeded prior to this pass) but has
no public content page. Its official source (`bing.com`/`aka.ms/bingbot`) is a JavaScript-rendered
page that could not be fetched and read during this verification pass — rather than publish a
page asserting a freshly-verified source that was not actually confirmed, the content page was
withheld pending a verification method that can actually read that page (e.g. a headless
browser, or a different Microsoft-published source).

## Re-verification cadence

Crawler documentation can change without notice. Before relying on any specific record for a
production decision:

1. Re-check the cited `official_source_url` directly.
2. If the token, purpose, or behaviour has changed, this is exactly what "registry drift"
   (`docs/registry/CRAWLER_REGISTRY_GOVERNANCE.md`) is for — update the record through a new
   registry version once the Super Admin registry workflow exists (Part 6), never by silently
   editing a published release.

## What "verified" means in the seed data

`last_verified_at` on each seed crawler reflects the date the record was checked against its
source during this development phase — it is not a claim of ongoing automated monitoring
(no such monitoring exists yet).

## Rejecting unverifiable crawlers

A crawler must not be added to the registry on the basis of a blog post, forum claim, or
unofficial aggregator alone — only the operator's own documentation counts as a reliable source
per FR-REG-005.
