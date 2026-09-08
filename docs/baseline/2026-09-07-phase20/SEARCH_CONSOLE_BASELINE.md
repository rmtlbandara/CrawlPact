---
Document owner: Engineering owner
Status: current-authoritative
Date: 2026-09-07
---

# Search Console baseline (Phase 20)

## Tool access in this execution environment

No Google-authenticated Search Console API/OAuth tool or session was available to this session —
confirmed by checking the available tool list before writing this document, the same check every
prior phase (7, 18, 19) performed and recorded. This gate is therefore:

**`BLOCKED_EXTERNAL_TOOL_ACCESS`** — not `PASS`.

## What is preserved below

The Phase 20 execution prompt supplied dated seed evidence describing a Search Console property
the product owner connected outside this session (`sc-domain:crawlpact.com`, a Domain property).
That evidence is reproduced here **exactly as supplied, labeled as external evidence this session
could not independently re-query** — not extended, not re-interpreted as more certain than it is,
and not used to fabricate any number not explicitly given.

### Baseline (as supplied, settled through 2026-09-05)

| Metric                      | Value      |
| --------------------------- | ---------- |
| Clicks                      | 6          |
| Impressions                 | 1,335      |
| CTR                         | ~0.449%    |
| Average position            | ~57.08     |
| First meaningful visibility | 2026-07-30 |

### Sitemap/indexing discrepancy (as supplied)

The sitemap summary reportedly showed `submitted ≈79, indexed: 0`, while direct URL Inspection on
sampled pages (homepage, the robots.txt AI validator, Amazonbot, GPTBot, the crawler directory,
the guides hub, the publishers page, the Vercel guide, About, the LLMS.txt validator) reportedly
returned `Submitted and indexed` / `PASS` / `robots.txt: ALLOWED` / `indexing: ALLOWED`.

**This session did not independently confirm either the sitemap summary field or the URL
Inspection verdicts** — no live query was possible. The seed evidence's own explanation (Search
Console's sitemap-summary `indexed` field can legitimately be a stale/lagging/incomplete signal,
distinct from an actual per-URL Indexing/Coverage report or URL Inspection result) is a documented,
plausible reconciliation and is preserved as the working explanation, but it remains **unverified
by this session** and should not be cited as independently confirmed until a session with real API
access re-checks it.

### Canonical fragmentation (as supplied) — now addressed at the technical level

The seed evidence described Search Console measuring both trailing-slash and non-trailing-slash
forms of several pages as separate URLs (e.g. the robots.txt AI validator: 149 vs. 209
impressions; Amazonbot: ~14 vs. ~232). This phase's fresh, independently-verified production
checks (see `CANONICAL_URL_CONTRACT.md`) found the _underlying cause_ still live in production —
the non-slash form of these exact pages was returning a temporary (307) redirect rather than a
permanent one, and several other pages had no redirect between variants at all. The canonical
fix in this phase (permanent 301 redirects, sitemap listing the slash form only) directly
addresses the mechanism that would keep producing this fragmentation. **Whether Search Console's
measurement actually consolidates going forward is not something this phase can observe** — that
requires real settled data after the fix ships, on the timeline in `PHASE_20_BASELINE_REPORT.md`'s
"measurement checkpoints" section.

## RISK-032 disposition

`docs/risks/ACTIVE_RISKS.md`'s RISK-032 was opened for "no Search Console property connected."
Per the seed evidence, a property is now connected (Domain property, `sc-domain:crawlpact.com`,
data since 2026-07-30). This session cannot independently confirm the connection is still live
(no API access), but has no reason to doubt externally-supplied evidence from the product owner's
own planning audit. RISK-032 is marked **resolved** in `ACTIVE_RISKS.md` (connection established),
with a new note that ongoing search-performance monitoring — not connection status — is now the
live concern, and that this session's inability to independently re-verify the connection is
disclosed rather than silently assumed away. See `DOCUMENTATION_CONFLICTS.md` for the exact
before/after.

## GA4 and CrUX (Sections 29, 31–32 of the Phase 20 prompt)

Not re-investigated with live tooling this phase (no GA4/CrUX API access in this environment
either). The existing architecture (production-only, consent-gated GA, excluded from private
routes) was reviewed in source during the canonical/robots.txt work and nothing in it was
touched — see `PHASE_20_BASELINE_REPORT.md`'s "deliberately not changed" section. CrUX field-data
state: **not re-checked this phase**; the seed evidence's own framing (`NO_FIELD_DATA` is a valid,
honest outcome for a young, low-traffic origin — not a failure) still applies and is not restated
as a new finding.
