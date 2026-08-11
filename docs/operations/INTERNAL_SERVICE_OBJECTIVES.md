# Internal Service Objectives

**Level 2 document.** Phase 14. Realistic internal targets built on `SERVICE_LEVEL_INDICATORS.md`'s
ratios. **These are internal targets, not a published SLA** — never shown to customers, never
contractual. No target below was invented to "look professional"; each is either a direct
restatement of an existing product commitment or explicitly marked as provisional pending real
measurement history.

## Monitoring scans completed within cadence window

**Internal target**: every `active` monitored domain's scheduled scan completes within its plan's
committed cadence (Free: none, Solo: monthly, Pro/Agency: weekly) — restates the existing product
commitment (SRS §25), not a new number. Measured today via
`capacity.monitoring.longOverdueActiveDomainCount`, which should be `0` in steady state; a
non-zero count is a Phase 14 operational alert (`monitoring.backlog_critical`), not silently
tolerated.

## No missed retention run beyond defined tolerance

**Internal target**: the daily `data_retention_purge` job runs and completes (`completed` or
`completed_with_errors`, not `failed`/missing) at least once every 26 hours (a 2-hour grace window
past the 24-hour cadence, matching `detectSchedulerAnomalies`'s own "missed" threshold logic scaled
to a daily job). Not yet measured against real sustained history — provisional.

## Valid billing webhook processing success

**Internal target**: ≥99% of received `webhook_events` reach `status = 'processed'` within the
window that they're received in. **Provisional** — based on the existing `publicImpact` threshold
logic (3+ recent failures is treated as a real pattern) rather than a measured historical baseline,
since real billing volume has been low to date. Revisit once `SERVICE_LEVEL_INDICATORS.md`'s
`billingProcessingReliability` ratio has accumulated a meaningful sample.

## No unresolved production deployment health failure

**Internal target**: every production deployment passes its full smoke-test suite
(`scripts/smoke-test.ts`) before being considered complete, and any post-deploy Worker/D1 error
observed in the following observation window (see
`docs/operations/PHASE_14_STATUS_OPERATIONS_BASELINE.md` "Post-deployment observation") is
investigated before the next deploy. Already the established practice (every Phase 12+ deployment
in this repository's history independently re-verified via `smoke-test.ts` rather than trusting the
workflow's own success claim) — restated here as an explicit objective, not a new practice.

## What was deliberately not set

- **No numeric uptime target** (e.g. "99.9%") — no reliable measurement history exists yet; see
  `docs/product/PHASE_14_PUBLIC_UPTIME_PERCENTAGE_DECISION.md`. Setting one now would be inventing
  a number, not measuring one.
- **No error budget** — evaluated (see below) and judged not to add operational value yet at
  CrawlPact's current real traffic volume.

## Error budget decision

A lightweight error-budget model ("N allowed failures within a measurement window, alert when
exceeded") was evaluated against the ratios in `SERVICE_LEVEL_INDICATORS.md`. **Not implemented**:
at current real volume (a handful of accounts, low scan/webhook throughput), the denominators in
every ratio are small enough that a single failure already moves the percentage significantly — an
error-budget threshold on top of that would either fire on noise or be set so loose it never fires
at all, providing no real signal beyond what `detectSchedulerAnomalies` and the Phase 14 operational
alerts already provide. Revisit once `SERVICE_LEVEL_INDICATORS.md`'s ratios show denominators
consistently large enough (dozens+ per window) for a budget threshold to mean something.
