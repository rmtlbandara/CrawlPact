# Finding Lifecycle Model

Not defined anywhere in the SRS (confirmed by grep during Phase 8 baseline research) — this is a
net-new design filling a genuine gap, built directly on the existing finding-fingerprint mechanism
rather than inventing a parallel identity scheme.

Implemented in `apps/web/src/lib/finding-lifecycle.ts`.

## States

`appeared | persisting | changed | resolved | unable_to_compare`

## Identity

A finding's cross-scan identity is its existing fingerprint
(`packages/policy/src/findings.ts`, `fingerprint([code, affectedCrawlerId ?? "", evidence])`).
Phase 8 makes this fingerprint queryable cross-scan by storing it as a first-class, indexed column
(`findings.fingerprint`, additive migration — see the migration section of the completion report)
rather than only inside the `evidence` JSON blob it lives in today. Existing rows are backfilled
in the same migration by recomputing the fingerprint from their own `finding_code` +
`affected_crawler_id` + parsed `evidence.evidenceSummary` (the same three inputs the original
function used), so old and new findings share one identity scheme — no dual-format handling is
needed at query time.

## Classification (given two comparable scans, per the comparison model's own comparable-state

rules)

- **`appeared`**: fingerprint present in the current scan's findings, absent from the previous
  scan's.
- **`persisting`**: fingerprint present in both, and `severity`, `affectedCrawlerId`, `category`,
  and `recommendedAction` are unchanged.
- **`changed`**: fingerprint present in both, but one of `severity` / `affectedCrawlerId` /
  `evidence` (re-derived summary) / `recommendedAction` / `rulesetVersionId` differs. Note a
  finding's fingerprint is itself partly derived from `evidence` — in practice a genuine evidence
  change usually also changes the fingerprint (making it `appeared`+`resolved` instead of
  `changed`); `changed` is reserved for the narrower case where severity/crawler/recommendation
  shifts under an unchanged fingerprint (e.g. a ruleset update reclassifies severity without
  altering the underlying evidence text).
- **`resolved`**: fingerprint present in the previous scan, absent from the current scan, **and**
  the current scan's status is `completed`/`completed_with_warnings` with a non-empty comparable
  evidence set for that finding's category — i.e. resolution is never claimed from a partial or
  failed current scan, matching this phase's own explicit "do not describe a finding as resolved
  when the current scan is partial or failed unless the system can prove resolution" rule.
- **`unable_to_compare`**: either scan is not comparable per the comparison model's rules (partial/
  failed scan, or the previous scan's finding evidence has aged out of retention).

## Display

Each changed/appeared/resolved finding shown in the timeline/comparison carries: title, lifecycle
state, current severity, affected purpose, change origin (from the attribution model — a finding
inherits its parent event's origin, it does not get independently attributed), evidence link,
recommended action, and previous/current values where the dimension that changed is shown
side-by-side (e.g. severity `medium → high`).

## Test coverage

`apps/web/tests/unit/finding-lifecycle.test.ts` — appeared, persisting, changed (severity shift
under stable fingerprint), resolved (only against a complete current scan), resolved incorrectly
claimed against a partial scan (must classify as `unable_to_compare` instead), unable_to_compare
from expired previous evidence.
