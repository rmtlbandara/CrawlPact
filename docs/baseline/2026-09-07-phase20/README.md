---
Document owner: Engineering owner
Status: current-authoritative
Date: 2026-09-07
---

# Phase 20 evidence package — index

Phase 20 (Authoritative Baseline, Production Parity & Search Foundation) established the
canonical-URL/search-foundation ground truth for CrawlPact and fixed the technical defects it
found. This directory is the evidence freeze and decision record for that pass.

| File                          | Contents                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `PHASE_20_BASELINE_REPORT.md` | Executive baseline: what was found, what was fixed, what's deferred                                |
| `PRODUCTION_PARITY_MATRIX.md` | Git/CI/deploy/database state at the start of the pass                                              |
| `CANONICAL_URL_CONTRACT.md`   | The chosen canonical-slash policy and exactly how it's enforced                                    |
| `PREVIEW_SEARCH_ISOLATION.md` | The P0 preview-indexing-isolation defect and its fix                                               |
| `SEARCH_CONSOLE_BASELINE.md`  | GSC seed evidence as supplied for this phase, and what could/couldn't be independently re-verified |
| `DOCUMENTATION_CONFLICTS.md`  | Stale-documentation defects found and how each was resolved                                        |

See `docs/reports/PHASE_20_AUTHORITATIVE_BASELINE_PRODUCTION_PARITY_SEARCH_FOUNDATION_COMPLETION_REPORT.md`
for the full completion report (verdict, exact commands run, deferred items, Phase 21/22/23
handoff).

## Scope note

This phase did not have live Google Search Console API/OAuth access, live Google Analytics
account-scope access, or a CrUX API key available in its execution environment. Where the prompt
supplied dated seed evidence (Search Console metrics through 2026-09-05), it is reproduced in
`SEARCH_CONSOLE_BASELINE.md` labeled exactly as supplied, external evidence — not independently
re-queried, and not fabricated or extended. Where live verification _was_ possible (production and
local Cloudflare-Workers-compatible runtime behavior via `wrangler dev --local`), it was performed
and is cited with exact commands/output in `PHASE_20_BASELINE_REPORT.md`.
