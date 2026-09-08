---
Document owner: Engineering owner
Status: current-authoritative
Date: 2026-09-08
---

# CrUX field-data state (Phase 20)

Source: direct Chrome UX Report API query, origin `https://crawlpact.com`, independently run this
session (`~/.config/crawlpact-crux/check_crux.py`, which reads its API key internally and never
prints it — output redacts the key even on error). No credentials read or reproduced by this
session.

## Result — independently confirmed

| Query            | HTTP status | State           |
| ---------------- | ----------- | --------------- |
| All form factors | 404         | `NO_FIELD_DATA` |
| Phone            | 404         | `NO_FIELD_DATA` |
| Desktop          | 404         | `NO_FIELD_DATA` |

**CrUX field-data state: `NO_FIELD_DATA`.**

## Interpretation

A 404 from CrUX's `records:queryRecord` endpoint means Google does not currently have a
sufficiently large, eligible sample of real Chrome user experiences for this origin to publish a
record — expected for a young, low-traffic site (consistent with this phase's own Search Console
and GA4 findings: single-digit-to-low-double-digit real sessions). **This is not a technical
failure and is not evidence of poor performance.** Per instruction, this is recorded as exactly
that state — not `PASS`, not `FAIL`, no fabricated p75 values.

## Lab fallback (clearly separate from field data)

No new Lighthouse run was performed this phase. The existing, already-documented lab baseline is
`docs/performance/PHASE_11_PAGE_PERFORMANCE_RESULTS.md` (Phase 11) — cited here as the current
synthetic reference, not re-validated or re-labeled as field data. `deploy-preview.yml` already
runs a Lighthouse budget check against every Preview deployment
(`pnpm run lighthouse:check`), so a fresher lab data point will exist automatically the next time
this phase's changes are deployed to Preview.

**Lab and field data must never be conflated.** Nothing in this phase's evidence package uses a
Lighthouse score to make a claim about real-user Core Web Vitals, and nothing here uses the absence
of CrUX data to claim or imply a Lighthouse score is "passing" in a Core Web Vitals sense.

## Decision

CrUX state recorded as `NO_FIELD_DATA` (Phase 20 Decision 10 — see the decisions record in the
completion report). No action required until real traffic volume grows enough for Google to
publish a record; revisit opportunistically in a future phase, not on a fixed schedule.
