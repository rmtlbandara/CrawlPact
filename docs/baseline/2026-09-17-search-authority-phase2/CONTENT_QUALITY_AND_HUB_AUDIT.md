---
Document owner: Engineering owner
Status: current-authoritative (Phase 2, §23-25, §28 — guide/platform/vertical quality and hub architecture)
---

# Guide/Platform/Vertical Quality and Hub Architecture Audit — 2026-09-18

## Platform pages (§24) — checked, no gap found

Read all 5 platform pages in full (Cloudflare, Netlify, Shopify, Vercel, WordPress). Each
describes a genuinely distinct, platform-specific mechanism (Cloudflare's AI Crawl Control vs.
managed robots.txt; Netlify's automatic deploy-preview `noindex`; Shopify's deliberately-limited
`robots.txt.liquid` Liquid objects; Vercel's preview-deployment `noindex` plus Next.js
file-convention robots; WordPress's virtual robots.txt and version-dependent "Discourage search
engines" behavior), each with 2-3 real official sources and a verification date. None are
templated boilerplate with the platform name substituted in. No consolidation or rewrite
warranted.

## Vertical pages (§25) — checked, no gap found

Read all 4 vertical pages (agencies, publishers, SaaS/documentation, web developers). Each states
a genuinely distinct `primaryProblem` (cross-client monitoring at scale; the search-vs-training
distinction plus CDN-driven policy drift; multi-subdomain documentation discoverability; the gap
between intended and actually-deployed policy) and a distinct `recommendedPlan`
(agency/pro/pro/solo) and tailored related-content links. Not generic "AI crawler management for
every industry" copy. No action needed.

## Guide quality (§23) — one real staleness issue found and fixed

Checked all 21 guides' `publishedDate`/`updatedDate` fields and read the two oldest
(`google-extended-vs-googlebot.md`, `robots-txt-syntax-basics.md`, both 2026-07-01) plus every
guide whose subject matter could have been affected by Phase 1's Apple finding.

**Found**: `applebot-vs-applebot-extended.md` (published 2026-07-24, before Phase 1's 2026-09-17
freshness audit) described base `Applebot` purely as "Apple's general-purpose crawler... for
features like Siri and Spotlight Suggestions" — accurate as far as it went, but silent on Apple's
own documentation (already verified verbatim in `CRAWLER_REGISTRY_FRESHNESS_AUDIT.md`) stating
that Applebot-crawled data "may be used to provide additional context and up-to-date content when
AI models are used to generate output for display in Apple products and services." Since this
guide's entire purpose is helping a reader correctly distinguish what each of the two tokens
covers, omitting Applebot's own AI-adjacent role could lead a reader to wrongly assume
disallowing only `Applebot-Extended` fully addresses "the AI stuff."

**Fixed**: added the verbatim-sourced context-supplying role to the token description and
clarified in the decision section that `Applebot-Extended` only addresses training, not this
separate use — and that no narrower token currently exists for it. Did not add a link to
`/crawlers/applebot/` since that page doesn't exist yet (Applebot isn't in a published registry
release — see `REGISTRY_RELEASE_DECISION.md`); the fix is a prose-only accuracy correction,
independent of the registry publication timeline.

**Checked, no other staleness found**: the two 2026-07-01 guides (`google-extended-vs-googlebot`,
protocol-mechanics `robots-txt-syntax-basics`) match Phase 1's "no change" findings for Google, and
RFC 9309 group-matching behavior doesn't go stale. Not every one of the 21 guides was re-read in
full this pass — this was a targeted check against the one known evidence change (Apple), not an
exhaustive line-by-line re-verification of all 21.

## Hub architecture (§28) — one real inconsistency found and fixed

`crawlers/index.astro` and `platforms/index.astro` both group their listings into labeled
sections (crawler purpose lanes; platform categories) specifically for scannability at 20+/5+
entries — `crawlers/index.astro`'s own comment cites this as a deliberate design decision
(`docs/design/EVIDENCE_OBSERVATORY_REDESIGN_SPEC.md §4C`). `guides/index.astro`, despite having
the exact same shape of categorical data available (`category`: decision/implementation/
troubleshooting) and the same 21-item scale, rendered as one flat two-column grid with the
category shown only as a small per-card label — the "giant undifferentiated link list" pattern
§28 explicitly warns against, and an inconsistency with the two sibling hubs' own established
pattern.

**Fixed**: grouped `guides/index.astro` into the same three labeled sections
(`CATEGORY_ORDER`/`CATEGORY_LABEL` pattern copied from `platforms/index.astro`), sorted by
publish date within each group as before. Verified via a full production build: all 21 guides
still present (`grep` count unchanged), all 3 category headings render
(`Decision guides`/`Implementation guides`/`Troubleshooting guides`). `/guides` is already covered
by the accessibility smoke suite (`home.spec.ts`), so this structural change gets automatic WCAG
regression coverage without needing a new test.

## Not yet covered this pass

- Tool quality (§22) — separately audited earlier this session (all 5 tools already have
  consistent What-this-checks/What-this-doesn't-check/Related/audit-CTA structure); no new gap
  found this pass.
- A full line-by-line re-read of all 21 guides for factual currency beyond the one known Apple
  change — genuinely not done, flagged honestly rather than claimed complete.
- Content consolidation / duplicate-intent analysis (§26) — not started this pass.
- Operator authority page decision (§29) — not started this pass.
- Metadata quality audit for duplicate titles/descriptions (§30) — not started this pass.
