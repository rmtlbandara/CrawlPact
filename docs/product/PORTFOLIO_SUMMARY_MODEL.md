# Portfolio Summary Model

## Principle

Every number on the portfolio summary must be an exact, explainable `COUNT(*)` of domains matching
a stated, deterministic condition — never a derived/weighted "score." This directly implements
prompt §6.1 and §13's "Do not create an opaque portfolio score."

## Metrics (all scoped to `owner_user_id = user.id AND deleted_at IS NULL`)

| Metric                      | Condition                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| Total saved domains         | all live domains                                                                                      |
| Monitoring active           | `monitoring_state = 'active'`                                                                         |
| Monitoring disabled         | `monitoring_frequency = 'none'` (plan doesn't include monitoring)                                     |
| Monitoring paused           | `monitoring_state = 'paused' AND monitoring_frequency != 'none'`                                      |
| Requiring attention         | domain has ≥1 open row in the attention-queue query (`PORTFOLIO_ATTENTION_MODEL.md`)                  |
| Incomplete evidence         | latest scan `status IN ('completed_with_warnings','incomplete')`                                      |
| Failed latest scan          | latest scan `status IN ('target_unavailable','blocked_for_safety','rate_limited','internal_failure')` |
| Meaningful changes (period) | ≥1 `domain_change_events` row with `event_type != 'baseline'` and `observed_at >= periodStart`        |
| Website-policy changes      | latest `domain_change_events.change_origin = 'website_policy'` within period                          |
| Registry-driven changes     | latest `domain_change_events.change_origin = 'registry_driven'` within period                         |
| Baseline pending            | `last_scan_id IS NULL`                                                                                |

## Query architecture — no full-history scan

Each row above is produced by exactly one bounded, indexed query against **current-state columns**
(`domains.monitoring_state`, `domains.last_scan_id`, latest `scan.status`) or a
**date-bounded** `domain_change_events` query (`WHERE domain_id IN (owned) AND observed_at >=
?`), never a full scan of a domain's entire history. This reuses `getLatestChangeEventPerDomain`'s
existing no-N+1 windowed-query pattern (Phase 8, `domain-timeline.ts`) rather than inventing a
second aggregation strategy — see `PHASE_09_PORTFOLIO_QUERY_AND_INDEX_AUDIT.md` for the exact
`EXPLAIN QUERY PLAN` output and D1-rows-read measurement per metric.

## Period filters

"Last 7 days" / "Last 30 days" / "Available retained history" — the third option is bounded by the
account's own `plans.history_retention_days`, never unbounded, and its label states this
("Available retained history" — not "All time," which would misrepresent data that's already
been purged per the retention policy).

## Rules enforced

- Every count renders as a link (`<a href="/app/workspace/domains?filter=...">`) to the portfolio
  table pre-filtered to exactly the domains counted — the count and the link target are computed
  by the _same_ query, so they can never drift apart.
- The summary shows a literal timestamp ("Data as of {server render time}"), never the word
  "real-time."
- No portfolio health score, no cross-account comparison, no industry benchmark — none of these
  exist anywhere in this module.
