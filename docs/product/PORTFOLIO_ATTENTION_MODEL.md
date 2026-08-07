# Portfolio Attention Model

Covers both the Attention Queue (§14) and the Portfolio Change Feed (§15) — they share one query
module (`apps/web/src/lib/portfolio.ts`, function `listPortfolioAttentionItems` /
`listPortfolioChangeFeed`) because both read the same underlying source (Phase 8's
`domain_change_events`, joined with current `domains` state) with different filter defaults.

## Attention queue — deterministic categories

A domain appears in the queue when **any** of these hold (each is a plain boolean condition over
already-materialized columns, no ML/heuristic scoring):

| Category                                | Condition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New high-attention finding              | latest `domain_change_events.attention_level = 'high_attention'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Registry-driven change requiring review | latest event `change_origin = 'registry_driven'`, `attention_level != 'informational'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Website-policy change requiring review  | latest event `change_origin = 'website_policy'`, `attention_level != 'informational'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Mixed policy conflict                   | latest event `change_origin = 'mixed'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Monitoring paused after failures        | `domains.monitoring_state = 'paused' AND domains.consecutive_failure_count >= FAILURE_PAUSE_THRESHOLD` (the exact threshold `recordScheduledScanOutcome` itself uses to auto-pause, `monitoring.ts`'s `FAILURE_PAUSE_THRESHOLD = 5` — a domain a user paused manually before ever failing 5 times in a row will not match this, though a domain the user paused manually _after_ accumulating failures close to the threshold could still match; the schema has no separate "why was this paused" reason column, so this is the closest deterministic proxy available without a new column, and is documented here as an approximation, not asserted as exact) |
| Latest scan incomplete                  | latest scan `status IN ('completed_with_warnings','incomplete')`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Latest scan failed                      | latest scan `status IN ('target_unavailable','blocked_for_safety','rate_limited','internal_failure')`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Baseline pending                        | `domains.last_scan_id IS NULL`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

"Search-related conflict" / "Training-policy reversal" (prompt §14) are not separate query
categories — they are specific instances of `change_origin = 'website_policy'` with
`affected_purposes_json` containing `search` or `training`; the queue surfaces them via the
existing `affectedPurposesJson` field already on `domain_change_events`, not a new classification.

## Required fields per row

Domain, group name, attention reason (the category above), change origin, observed date,
monitoring state, primary action — all read directly off `domains` + the latest
`domain_change_events` row per domain, joined once (batched, not per-row) exactly like
`getLatestChangeEventPerDomain`.

## Primary actions

Open domain (`/app/domains/[domainId]`), view change (`/app/domains/[domainId]#timeline`), view
evidence (same page), run rescan (existing per-domain rescan button — no new bulk primitive per
`PHASE_09_BULK_RESCAN_DECISION.md`), resume monitoring (existing per-domain toggle).

## Rules enforced

- No task/assignment objects are created — a queue row is a read, not a stored claim (§6.6, no
  fake collaboration).
- Not every row is labelled "urgent" — `attentionLevel` is rendered verbatim
  (`informational`/`review_recommended`/`high_attention`), reusing Phase 8's existing three-value
  vocabulary rather than inventing a new severity scale.
- Bounded, server-side paginated (default page size 25, max 100), filterable by group/change-origin/
  attention-level/monitoring-state — no full-report payload is ever included in a queue/feed row
  (only `summary`, never `detailsJson` or raw evidence).

## Portfolio change feed — inclusion/exclusion

**Included**: `website_policy_change`, `registry_driven_change`, `mixed_change`, `baseline`
(establishment only), and `operational_change` rows where the change altered `completeness`
(`complete` → `partial` or back) — matching prompt §15's "important completeness changes."
Monitoring pause/resume is surfaced by joining current `domains.monitoring_state` next to each row,
not as its own separate event type (no new event-generation code path — Phase 8's
`domain_change_events` table is not touched).

**Excluded/collapsed**: every unchanged scan (Phase 8's `generateTimelineEvent` already returns
null and writes nothing for a no-material-change scan, so there is nothing to filter here — it
simply never produced a row), authentication events, billing events, retries, unrelated admin
actions (none of these are `domain_change_events` rows in the first place).

## Idempotency and ordering

`domain_change_events.fingerprint` is already unique per Phase 8 migration 0026 — the feed can
never show a duplicate event under retry because the underlying table can never contain one.
Ordering is `observed_at DESC, id DESC` (stable tie-break) with keyset pagination
(`observed_at < cursor OR (observed_at = cursor AND id < cursor_id)`), not `OFFSET`, so a page
never shifts under concurrent inserts.

## Account isolation

Every query in this module takes `ownerUserId` as a mandatory parameter and joins
`domain_change_events → domains ON domains.id = domain_change_events.domain_id AND
domains.owner_user_id = ?` — there is no code path that can read another account's events, and
`PHASE_09_AGENCY_WORKSPACE_THREAT_REVIEW.md` includes a direct cross-account test against this
exact function.
