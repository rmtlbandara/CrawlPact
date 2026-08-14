# Phase 19 Registry Maintenance Policy

Status: current-authoritative, 2026-08-14. Does not duplicate Phase 15's immutability/provenance
mechanics (`docs/registry/CRAWLER_REGISTRY_GOVERNANCE.md`) — focuses on the ongoing operating
question those mechanics don't answer: _when_ to investigate and _when_ to release.

## When to investigate (review triggers, §97)

- An official crawler-operator source document changes.
- A crawler appears or disappears from an operator's published list.
- A crawler's stated purpose changes (e.g., search vs. training distinction shifts).
- A user-agent token changes.
- A previously-cited evidence source becomes unavailable (404, moved, deprecated).
- A credible customer correction is received.
- Periodic source-health check (see cadence below), scoped to current maintenance capacity — not
  every crawler re-verified every week.

## When to release

A candidate release is published only after: verification against the current official source,
semantic-change classification (evidence-only vs. evaluation-semantic, per the existing Phase 15
diff model), candidate validation, and an explicit publish action by a Super Admin. **Never
automatic** — a source change alone does not activate a new registry release (§96). This is
unchanged, existing Phase 15 behavior; this policy states it explicitly as a standing rule rather
than an implicit assumption.

## User-impact evaluation before notification

A new registry release generates a user notification only when it materially affects that
specific user's saved-domain evaluation under the existing Phase 8/10 attribution model — never a
blanket "registry updated" broadcast to every account (§98, no global alert storm). This is
existing behavior; restated here as a standing constraint on any future registry-related feature
work.

## Current state (2026-08-14)

- Active release: `reg_2026_07_3` / ruleset `rules_2026_07_2` — unchanged since Phase 15.
- Known pending candidate: `packages/database/seed/reference-data.sql` contains independently
  re-verified Amazon/Google/Bingbot corrections, ready but not yet published (per
  `docs/status/CURRENT_STATE.md`) — this remains a real Super Admin action, not something this
  pass performs, since publishing a registry release is a governed action requiring the explicit
  publish step above, not a documentation task.
- Registry seed immutability (RISK-018) fix remains in place and tested — no regression found in
  this pass's read-only verification.

## Review cadence

Periodic source-health checks happen at a cadence appropriate to current maintenance capacity —
not a fixed weekly commitment while external usage remains near zero. Revisit this cadence once
real monitored-domain volume grows enough that registry staleness would visibly affect more
accounts (tied to the north-star metric, `external monitored domains`).
