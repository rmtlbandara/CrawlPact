# Phase 09 — Cross-Domain Comparison Decision Gate

## Question

Should the agency workspace let a user compare policy, score, or findings between two _different_
domains (as opposed to Phase 8's scan-to-scan comparison for one domain over time)?

## Findings (quoted/paraphrased from the SRS)

Every "compare/comparison" reference found in the SRS is temporal (same domain, different points
in time), never cross-domain:

- "Compare search and training crawler access" — a crawler-type axis, not a domain axis.
- "Compare scans" — same-domain scan history.
- "Compare with selected preset" — policy-vs-preset, same domain.
- §12.2 journey: "the user opens the before-and-after comparison" — temporal, same domain.
- §25 (monitoring): "Compare semantic changes" — scan-to-scan diffing for scheduled monitoring.

No SRS text describes comparing two or more _different_ domains against each other. The
traceability doc's §10.29 row (`lib/domain-comparison.ts`) is also scan-to-scan, matching Phase 8's
own implementation exactly as built.

## Why this needs separate authorisation, not just an engineering decision

The prompt's own reasoning is sound and independently verifiable against the product's design:

- **Different websites can have different, legitimate policy objectives.** A publisher blocking
  training crawlers and a documentation site allowing them are not "worse" or "better" than each
  other — Phase 8's own `PHASE_08_POLICY_OBJECTIVE_DECISION.md` established that CrawlPact
  evaluates a site's _stated_ preset, not a universal ideal. A side-by-side score comparison across
  domains with different presets would silently misrepresent that.
- **Scores are not designed to be ranked against each other** — CrawlPact's scoring exists to
  describe one domain's own policy completeness, not to produce a competitive leaderboard.
- **A ranking UI is one implementation choice away from a fabricated benchmark** — exactly what
  §13 and §71 ("Do not show fabricated industry benchmarks" / "Do not compare agencies to unrelated
  customers") already prohibit elsewhere in this same phase.

## Decision

**Cross-domain comparison is not authorised and is not implemented in Phase 9.**

## What is provided instead

- **Filtered portfolio counts** (Portfolio Summary, §13) — e.g. "6 domains with website-policy
  changes this period" — aggregate, not a side-by-side ranking of named domains against each
  other.
- **Group-level state summaries** (§18) — the same explainable counts, scoped to one group.
- **Domain-level evidence links** — every count and queue row links to that one domain's own
  evidence, timeline, and Phase-8 scan-to-scan comparison (unchanged).

None of this is described as "cross-domain comparison" anywhere in this phase's UI copy, code
comments, or documentation — the aggregated counts are counts, not a comparison feature, and are
labelled accordingly throughout (`PORTFOLIO_SUMMARY_MODEL.md`).

## Re-evaluation trigger

Revisit only if a future SRS revision explicitly authorises cross-domain comparison, defines how
differing preset objectives are represented so a comparison cannot be misread as a ranking, and
defines the entitlement and UX rules such a feature would need.
