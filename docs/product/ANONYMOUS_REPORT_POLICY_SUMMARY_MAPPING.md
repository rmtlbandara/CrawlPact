# Anonymous Report Policy Summary — Deterministic Mapping

**Level 1 document (Current authoritative).** Defines exactly how the executive policy-impact
summary shown above every audit report (`AuditReportView.tsx`) is derived from the existing
`AuditReportResponse` payload. Established Phase 5, 2026-08-04. Implementation:
`apps/web/src/lib/policy-summary.ts`; tests: `apps/web/src/lib/policy-summary.test.ts`.

**This is a pure display-derivation layer, not a second evaluation engine.** Every input it reads
(`crawlerMatrix[].purpose`, `crawlerMatrix[].result`, `findings[].code`, `score.state`) is already
computed by `packages/policy` (conflicts/scoring/recommendations) and persisted before this
function ever runs. Nothing here re-evaluates robots.txt, re-scores, or overrides an existing
finding — it only classifies already-computed results into one of a fixed set of labels.

## Inputs used

- `report.crawlerMatrix` — grouped by `purpose` (`search | training | user_triggered | agent |
advertising_validation | research | mixed | unknown`, `packages/core/src/api/contracts/audit.ts:91-100`)
  and filtered by `result` (`allowed | blocked | no_explicit_rule | mixed | unknown |
resource_unavailable | not_evaluated`, contract lines 81-89).
- `report.findings[].code` — specifically the four real conflict codes from
  `packages/policy/src/conflicts.ts` that represent genuine cross-signal contradictions:
  `SEARCH_VISIBILITY_CONFLICT`, `TRAINING_RESTRICTION_CONFLICT`,
  `RSL_CONTENT_SIGNALS_DISAGREEMENT`, `HEADER_SITE_DISAGREEMENT` — and two that indicate
  incomplete evidence rather than a contradiction: `PAGE_DIRECTIVE_UNREACHABLE`,
  `UNKNOWN_PURPOSE_REQUIRES_REVIEW`. This is an explicit, hand-maintained list, not a substring
  match, so a future new conflict code does not silently get miscategorised.
- `report.score.state` — `"scored" | "incomplete"`.

## Shared classification core

For the three symmetric dimensions (training-policy declaration, user-triggered retrieval, agent
access) and, with different labels, AI-search discoverability:

```
evaluated = crawlerMatrix.filter(row => row.purpose === <dimension purpose>)
              .filter(row => !["unknown","not_evaluated","resource_unavailable"].includes(row.result))
if evaluated.length === 0 → "Unable to determine"
hasAllowed = evaluated.some(row => row.result === "allowed")
hasBlocked = evaluated.some(row => row.result === "blocked")
hasMixed   = evaluated.some(row => row.result === "mixed")
if hasMixed or (hasAllowed and hasBlocked) → <mixed label>
else if hasBlocked → <restricted label>
else if hasAllowed → <allowed label>
else (only "no_explicit_rule" rows remain) → "Unspecified"
```

| Dimension                   | purpose filter   | allowed label              | restricted label      | mixed label           |
| --------------------------- | ---------------- | -------------------------- | --------------------- | --------------------- |
| Training-policy declaration | `training`       | Explicitly allowed         | Explicitly restricted | Mixed                 |
| User-triggered retrieval    | `user_triggered` | Explicitly allowed         | Explicitly restricted | Mixed                 |
| Agent access                | `agent`          | Explicitly allowed         | Explicitly restricted | Mixed                 |
| AI-search discoverability   | `search`         | No explicit issue detected | At risk               | Attention recommended |

**AI-search discoverability upgrade rule**: if a `SEARCH_VISIBILITY_CONFLICT` finding is present,
the result is upgraded to "Attention recommended" even if the raw per-crawler matrix alone would
have computed "No explicit issue detected" — the finding represents real, already-vetted evidence
of a page-level conflict the per-crawler matrix rows alone don't fully capture. Never _downgrades_
a worse classification back toward "No explicit issue detected."

## Cross-signal consistency

```
if report.score.state === "incomplete" and crawlerMatrix.length === 0 → "Unable to determine"
else if findings contains any of [SEARCH_VISIBILITY_CONFLICT, TRAINING_RESTRICTION_CONFLICT,
        RSL_CONTENT_SIGNALS_DISAGREEMENT, HEADER_SITE_DISAGREEMENT] → "Conflict detected"
else if findings contains [PAGE_DIRECTIVE_UNREACHABLE, UNKNOWN_PURPOSE_REQUIRES_REVIEW]
        or any crawlerMatrix row has result in ["resource_unavailable","not_evaluated"]
        → "Incomplete evidence"
else → "No conflict detected"
```

Conflict detection takes priority over incompleteness: a real, already-detected conflict is
stronger, more actionable evidence than a general note that some other resource was unreachable.

## Monitoring dimension

Anonymous/unowned reports always show `"Not enabled"` — this is a static label, not derived from
report data, since an anonymous scan has no owning domain to monitor.

## Rules this mapping must never violate (SRS/brand-consistency, verified against implementation)

- Never describes `"no_explicit_rule"` as explicit permission — it maps to `"Unspecified"`, never
  to an allowed/restricted label.
- Never describes `"resource_unavailable"`/`"not_evaluated"` as a deliberate block — both are
  excluded from the `evaluated` set entirely, so they can only ever push a dimension toward
  `"Unable to determine"`, never toward `"At risk"`/`"Explicitly restricted"`.
- Never claims actual crawler behaviour — every label describes the **published policy signal**,
  matching `BRAND.approvedBoundaryStatement`'s existing framing.
- Never changes `report.score` — this module has no write access to score data and never computes
  one; it only reads already-computed fields.
- Every label pairs with a text string (no colour-only indication), consistent with `StatusChip`'s
  existing pattern used throughout the product.

## Worked examples (used directly as unit-test fixtures)

1. **Clean baseline**: all `search`/`training`/`user_triggered`/`agent` rows `allowed`, no
   findings → No explicit issue detected / Explicitly allowed / Explicitly allowed / Explicitly
   allowed / No conflict detected.
2. **Conflict report**: `search` rows `mixed` result and a `SEARCH_VISIBILITY_CONFLICT` finding →
   Attention recommended (search) / Conflict detected (cross-signal).
3. **Training unspecified**: all `training` rows `no_explicit_rule` → Unspecified.
4. **Partial/incomplete scan**: some rows `resource_unavailable`, a
   `PAGE_DIRECTIVE_UNREACHABLE` finding → Incomplete evidence; affected dimension(s) fall back to
   Unable to determine if no other evaluated rows exist for that purpose.
5. **Registry uncertainty**: `unknown` results dominate a purpose → Unable to determine for that
   dimension.
