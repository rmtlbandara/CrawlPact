# GitHub Governance Setup Manifest — 2026-08-03

**Status: verification-blocked (by user decision, not access failure).**

GitHub write access (milestones, labels, issues) was available this session via the `gh` CLI and
GitHub MCP tools (confirmed working — used read-only for `gh run list`/`gh api` checks during this
audit). Per the user's explicit instruction at the start of this Phase 0 run, no live milestones,
labels, or issues were created — this manifest instead records exactly what should be created,
so it can be applied later either by running the commands below or by a future session once
authorized.

## Milestones to create

```bash
gh api repos/rmtlbandara/CrawlPact/milestones -f title="Foundation and Trust" -f state="open"
gh api repos/rmtlbandara/CrawlPact/milestones -f title="Conversion and Monetisation" -f state="open"
gh api repos/rmtlbandara/CrawlPact/milestones -f title="Product Value" -f state="open"
gh api repos/rmtlbandara/CrawlPact/milestones -f title="Infrastructure and Reliability" -f state="open"
gh api repos/rmtlbandara/CrawlPact/milestones -f title="SEO and Market Authority" -f state="open"
gh api repos/rmtlbandara/CrawlPact/milestones -f title="Customer Validation" -f state="open"
gh api repos/rmtlbandara/CrawlPact/milestones -f title="Launch Readiness and Continuous Governance" -f state="open"
```

Each command is idempotent in effect (re-running against an existing title will create a
duplicate — check `gh api repos/rmtlbandara/CrawlPact/milestones` first and skip any title that
already exists before applying).

## Labels to create

```bash
# Priority
gh label create priority-p0 --color B60205 --description "Launch-blocking or critical" -R rmtlbandara/CrawlPact
gh label create priority-p1 --color D93F0B --description "High priority, not launch-blocking" -R rmtlbandara/CrawlPact
gh label create priority-p2 --color FBCA04 --description "Normal priority" -R rmtlbandara/CrawlPact

# Workstream
gh label create brand --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create conversion --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create product --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create website --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create infrastructure --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create database --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create security --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create billing --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create seo --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create documentation --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create analytics --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create legal --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create operations --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create registry --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create accessibility --color C5DEF5 -R rmtlbandara/CrawlPact
gh label create customer-validation --color C5DEF5 -R rmtlbandara/CrawlPact

# Status
gh label create blocked --color 000000 -R rmtlbandara/CrawlPact
gh label create needs-validation --color 000000 -R rmtlbandara/CrawlPact
gh label create accepted-risk --color 000000 -R rmtlbandara/CrawlPact

# Phase
gh label create phase-00 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-01 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-02 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-03 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-04 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-05 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-06 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-07 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-08 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-09 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-10 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-11 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-12 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-13 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-14 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-15 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-16 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-17 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-18 --color 5319E7 -R rmtlbandara/CrawlPact
gh label create phase-19 --color 5319E7 -R rmtlbandara/CrawlPact
```

Note: `gh label create` errors (not silently skips) if a label with that name already exists — a
future run should check `gh label list -R rmtlbandara/CrawlPact` first, or use
`gh label create ... --force` to overwrite the color/description of an existing label.

## Issues to create

### One umbrella issue

**Title**: `CrawlPact Improvement Programme — Phases 0–19 (umbrella)`
**Labels**: `priority-p1`
**Body**:

```markdown
Tracks the full CrawlPact improvement programme established by the Phase 0 baseline audit
(2026-08-03). See docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md for the phase index,
dependencies, and release gates, and docs/baseline/2026-08-03/ for the evidence baseline every
later phase must be consistent with.

Phase issues: link each phase-NN issue here as it is created.

This issue is never "closed" in the normal sense — it tracks programme completion through
Phase 19 (ongoing governance).
```

### One issue per phase (Phase 0 through Phase 19)

Each phase issue uses this template, with `{N}`, `{NAME}`, `{OBJECTIVE}`, `{DELIVERABLES}` filled
from `docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md`'s phase index:

**Title**: `Phase {N} — {NAME}`
**Labels**: `phase-{NN}`, plus the relevant workstream label(s)
**Body**:

```markdown
## Objective

{OBJECTIVE}

## Scope

See docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md#phase-{n} for full scope.

## Dependencies

{DEPENDENCIES}

## Required deliverables

{DELIVERABLES}

## Acceptance criteria

{COMPLETION GATE, from the roadmap}

## Out of scope

Anything not explicitly listed above; anything reserved for a later phase per the roadmap's
phase boundaries.

## Completion report requirement

This phase is not complete until a completion report is written summarizing what changed, what
was tested, what risks were found/resolved, and confirming no out-of-scope change was made.

## Links

- Baseline: docs/baseline/2026-08-03/PHASE_0_BASELINE_REPORT.md
- Roadmap: docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md
- Umbrella issue: #{umbrella-issue-number}
```

20 such issues (Phase 0 → Phase 19) should be created, each linked back to the umbrella issue.

### One issue per newly discovered actionable P0 risk

No new **P0** risk was found during this Phase 0 baseline (see
`docs/baseline/2026-08-03/BASELINE_RISKS_AND_UNKNOWNS.md` — the highest severities found this
session were P1: DC-004, DC-005, DC-006, R-003, R-005, R-011). Per the phase's own instruction, a
dedicated issue is only required for P0 risks; the P1 items above are recommended for tracking via
the phase issues that own their topic (Phase 1 for the documentation-conflict P1s, Phase 11 for
R-005, Phase 13 for R-011, Phase 15 for R-003) rather than as standalone issues, since none is
independently actionable outside its owning phase's scope.

## Idempotency note

Before running any of the above, check `gh issue list -R rmtlbandara/CrawlPact --search "Phase 0
in:title"` (and similarly for the umbrella issue's title) to avoid creating duplicates if a
previous session already created some of these.
