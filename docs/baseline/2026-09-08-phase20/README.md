---
Document owner: Engineering owner
Status: current-authoritative
Date: 2026-09-08
---

# Phase 20 evidence package — Day 2 addendum (real Search Console access)

This directory supplements `docs/baseline/2026-09-07-phase20/`, which established the canonical
URL contract, fixed preview search isolation, and implemented the trailing-slash redirect
foundation — all still current and not superseded. This addendum exists because two things
changed on 2026-09-08:

1. **Direct, read-only Google Search Console API access became available** (`sc-domain:crawlpact.com`,
   via local OAuth tooling at `~/.config/crawlpact-gsc/`), replacing 2026-09-07's
   `BLOCKED_EXTERNAL_TOOL_ACCESS` gate with real, independently-queried data — including a
   pre-change bulk URL Inspection snapshot (79 URLs) that was already run before this session
   started and was not re-run (per instruction, and to avoid unnecessary quota use).
2. That real data surfaced **two genuine defects the 2026-09-07 pass did not cover**: internal
   links across the site (footer, header, breadcrumbs, dynamic content-collection links) pointing
   to non-canonical (bare) URLs, and one specific canonical edge case (`/contact`) worth recording
   explicitly. Both are fixed in this pass — see below.

A third round the same day added direct, read-only **GA4 (Admin + Data API)** and **CrUX API**
access, closing the remaining two external-evidence gates.

No OAuth credentials, tokens, API keys, or their contents are reproduced anywhere in this
repository or in this evidence package — only aggregate, already-exported data (Search Console,
GA4) or a live, independently-run, credential-redacting script (CrUX) was used.

| File                                | Contents                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SEARCH_CONSOLE_BASELINE.md`        | Real, independently-verified GSC data: 28-day and 90-day performance, device/country, brand vs. non-brand, URL-fragmentation groups, canonical mismatches, and the two "discovered — not indexed" URLs' disposition                                                                                                                     |
| `INTERNAL_LINK_CANONICALIZATION.md` | The internal-link defect this real data helped surface, and the sitewide fix                                                                                                                                                                                                                                                            |
| `GA4_BASELINE.md`                   | Real GA4 data (2026-08-09→2026-09-05): traffic is almost entirely the owner's own testing (39/40 sessions from Sri Lanka); confirms GA4's production-only/consent/allowlist architecture is working; explains why key events = 0 (by design — the real product funnel lives in a separate first-party `product_events` system, not GA4) |
| `CRUX_FIELD_DATA_STATE.md`          | Independently re-confirmed `NO_FIELD_DATA` for all/phone/desktop; lab-data fallback reference, kept clearly separate from field data                                                                                                                                                                                                    |

## Tooling maintenance follow-up (low priority, not a Phase 20 blocker)

The local Google API tooling (`~/.config/crawlpact-gsc/venv`) runs Python 3.9.6, which the Google
API client libraries now warn is unsupported. Every query used this phase (GSC, GA4, CrUX) worked
correctly despite the warning, so this was not touched during Phase 20. Migrate the local tooling
venv to Python 3.12+ at a convenient future point — this is a note for whoever next touches that
local environment, not a CrawlPact repository risk (the tooling lives outside this repo, at
`~/.config/`, and is not deployed or shipped).

See the updated `docs/reports/PHASE_20_AUTHORITATIVE_BASELINE_PRODUCTION_PARITY_SEARCH_FOUNDATION_COMPLETION_REPORT.md`
for the current overall verdict.
