# Phase 13 Product-Event Retention Decision

**Level 4 document.** Resolves RISK-006 for `product_events` specifically (not `security_events`
or `notifications` — those remain separate, still-open decisions; see the risk entry).

## Decision

**18 months from `created_at`**, adopting Phase 11's own prior recommendation
(`docs/data/PHASE_11_RETENTION_DECISION_MATRIX.md:49-51`) unchanged — no conflicting
owner/legal decision exists, and the reasoning still holds: long enough for year-over-year
product/cohort analysis, short enough to bound growth, and the lowest-sensitivity of the three
categories Phase 11 flagged (aggregate usage metrics, already severed from a deleted user via
`ON DELETE SET NULL`, migration `0014_product_events_survive_account_deletion.sql`).

## Implementation

`purgeExpiredProductEvents` (`apps/web/src/lib/data-retention.ts`), registered as the
`expired_product_events` category in the existing `runDataRetentionPurge` orchestrator — same
daily cron, same chunked-delete/dry-run/backlog-remaining/failure-isolation guarantees as every
other retention category (Phase 11 architecture, unchanged). No new migration was required — the
job is a plain `DELETE ... WHERE created_at < cutoff LIMIT chunkSize` loop against the existing
`product_events` table and its existing `idx_product_events_created_at` index.

## What this does not touch

`security_events`, `notifications`, and billing retention are deliberately untouched — they are
different data categories (operational/security telemetry, not product-usage analytics) with
their own retention questions that remain open under RISK-006, not silently resolved as a side
effect of this decision.

## Raw vs. aggregate

Only raw `product_events` rows are subject to this 18-month bound. No separate aggregated-metrics
table was introduced this phase (see `docs/analytics/CRAWLPACT_PRODUCT_MEASUREMENT_STRATEGY.md`
"Measurement limitations" — the Super Admin dashboard queries raw rows directly, bounded by date
range, which is sufficient at CrawlPact's current real volume; a daily-rollup aggregate table is
explicitly deferred to a future phase if/when volume makes direct querying too expensive, per
Phase 11's own "no premature analytics infrastructure" discipline).
