# Phase 14 Public Uptime Percentage Decision

**Level 2 document.** Whether CrawlPact should publish a public uptime percentage on `/status`.

## Decision: not yet — percentage stays absent

Per §22/§151 of the Phase 14 prompt, a public uptime percentage may only be enabled once all seven
conditions are met:

| Condition                                     | Status                                                                                                                                                                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Measurement methodology is defined         | **Partially** — `docs/operations/SERVICE_LEVEL_INDICATORS.md` defines internal ratios, but none of them is yet defined specifically as "uptime" in the public-status sense (component-state-weighted availability over time) |
| 2. Sampling coverage is reliable              | **No** — `getPublicStatus()` is computed fresh on every request; there is no continuous sampling record of what the public status actually _was_ at any past moment, only what it is right now                               |
| 3. Status system itself is included honestly  | **No** — the status computation's own reliability (§82's correlated-failure risk) is not yet factored into any measurement                                                                                                   |
| 4. Maintenance treatment is defined           | **Partially** — scheduled maintenance is a distinct public state (never silently counted as "down" or "up") but no uptime formula exists yet to define how maintenance windows would be treated within it                    |
| 5. Unknown periods are not counted as healthy | **N/A** — no historical periods are tracked at all yet, so there's nothing to mis-count                                                                                                                                      |
| 6. A meaningful observation window exists     | **No** — zero days of historical status-state history exist; the recommended minimum is 30 days                                                                                                                              |
| 7. No historical periods are fabricated       | **Satisfied by construction** — since nothing is measured, nothing can be backfilled or fabricated                                                                                                                           |

**Conclusion**: conditions 2, 3, and 6 are unmet outright. Publishing a percentage now would mean
either inventing a number or computing one from a measurement window that doesn't exist —
explicitly prohibited ("Do not invent '99.99% uptime' because it looks professional," "Never
backfill fabricated historical uptime").

## What this phase did instead

Established the **measurement foundation**, not the publication:

- `SERVICE_LEVEL_INDICATORS.md` / `INTERNAL_SERVICE_OBJECTIVES.md` define internal reliability
  ratios (job/monitoring/billing reliability) computed from existing, already-authoritative tables
  (`scheduled_job_runs`, `scans`, `webhook_events`) — no new high-frequency sampling table was
  created (§20-21's own "do not write high-frequency health samples just to produce charts" rule).
- These ratios accumulate real history automatically, for free, as those tables grow — no separate
  backfill or sampling job needed. Once 30 days of real operation have passed, revisit this
  decision with real numbers rather than a redesign.

## What remains hidden

The public `/status` page continues to show only real-time component state, active incidents, and
scheduled maintenance — exactly as before this phase, per §22's "keep percentage absent... continue
showing incidents and component state... accumulate evidence naturally... simply omit unsupported
metrics" (not "explain what CrawlPact lacks" — no new trust-reducing copy was added to the public
page explaining the absence).

## Revisit trigger

Revisit once `SERVICE_LEVEL_INDICATORS.md`'s ratios have accumulated at least 30 days of real
production history **and** a specific decision is made about how the status-computation-itself's
own reliability (condition 3) and maintenance-window treatment (condition 4) fold into a single
published number — both genuine design questions, not just a data-volume threshold.
