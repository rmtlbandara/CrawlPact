# Phase 19 Capacity and Reliability Governance

Status: current-authoritative, 2026-08-14. References existing operational infrastructure rather
than duplicating it — see `docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md` for the full Free-plan
limit table (last re-verified live 2026-08-05, Phase 11) and
`docs/operations/OPERATIONAL_ALERT_MODEL.md`/`SERVICE_HEALTH_SIGNAL_MODEL.md` for the existing
alerting architecture. This document is the Phase 19 operating layer on top: current usage against
those triggers, and the recurring cadence for re-checking them.

## Current usage vs. triggers (2026-08-14)

| Resource          | Current                                                                                             | Free-plan limit           | Headroom                                           |
| ----------------- | --------------------------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------- |
| D1 database size  | 2.09 MB                                                                                             | 5 GB (account)            | Effectively unlimited headroom at current scale    |
| Total scans (30d) | 8                                                                                                   | 5M rows read/day (D1)     | No pressure                                        |
| Total users       | 2 (1 external, dormant)                                                                             | N/A (no user-count limit) | N/A                                                |
| Worker requests   | Not separately queried this pass — no evidence of approaching 100,000/day at current traffic levels | 100,000/day               | Presumed large headroom, not re-measured this pass |

**No upgrade trigger from `CLOUDFLARE_UPGRADE_TRIGGERS.md` is close to being crossed.** Per §74/75,
this is neither a reason to upgrade now nor a reason to wait until an outage — it's simply the
honest current state.

## RISK-034 (saved-domain N+1 query)

Unchanged, still `POST-LAUNCH`/accepted. Trigger (per that risk's own record and §78): Agency
100-domain portfolios becoming common, rising latency, or meaningful D1 read growth. None of
these conditions exist today (max domains for any single account: 4). Not prioritized this pass.

## RISK-033 / preview Lighthouse discrepancy — resolved 2026-08-17

This section went through two prior classifications, both since superseded — kept here as an
honest record rather than quietly erased. First: "preview-specific environmental difference, not a
production regression," reasoning from Phase 11's measurement without ever running the comparison
needed to prove it. Second (2026-08-15): after actually running that comparison, "a real,
currently-active, homepage-specific defect present in both preview and production" — root cause
not yet confirmed, leading hypothesis the hero `AuditForm` island delaying paint during hydration.

**Both were wrong in the same way: neither questioned whether Lighthouse's own measurement was
trustworthy.** It wasn't. Three independent real-network measurements — an out-of-band
Playwright/CDP trace against production, and Lighthouse itself run 3x with
`--throttling-method=devtools` (real network replay) instead of its default simulated Lantern
model — all showed the homepage genuinely healthy: 99-100/100, 700ms-1.6s LCP, zero long
main-thread tasks, in both environments. The 71-75/100, 5.6-6.3s numbers were an artifact of
Lantern's simulation badly misjudging this page's resource graph (11 script requests, from the
hydrated `AuditForm` island); real HTTP/2 multiplexing handles them fine. The hero-island
hypothesis from the prior pass was directionally right about _what made this page structurally
different_ — it just wasn't causing a real slowdown.

Fixed the actual measurement gap: `scripts/lighthouse-check.mjs` now uses
`--throttling-method=devtools`. That fix immediately surfaced a second, real, previously-masked
issue in the opposite direction: `/sample-report` dropped to 83/100 (4.2s LCP) under real-network
measurement. Root cause: `AnalyticsConsent.tsx` hardcoded its initial "has the visitor decided"
state instead of using the cookie `MarketingLayout.astro` already reads server-side, so a fresh
visitor's first paint never showed the banner — it flashed in ~2-3s later, and on
`/sample-report`'s sparser layout that delayed reveal became the LCP element. Fixed by threading
the real server-read consent state through as a prop. Verified: 83/100 (4.2s) → 94/100 (1.1s)
locally after the fix.

**Current state: RISK-033 closed** (`docs/risks/RISK_ARCHIVE.md` ARC-040). The preview CI
threshold was never lowered — it's now measuring something real, and both known issues it could
have been catching are fixed.

## Reliability metrics (baseline, from `PHASE_19_POST_LAUNCH_BASELINE.md`)

- Scan completion rate: 7/8 completed (87.5%) — the 1 incomplete scan's cause was not
  investigated in this pass (very low volume, likely a single anonymous first-visit scan; worth
  checking if the pattern repeats at higher volume).
- No production incidents recorded in `/admin/operations` as of this baseline (not independently
  re-verified live in this pass beyond the smoke-test confirmation already done during the Phase
  0-18 reconfirmation).

## Observability

Cloudflare-native Worker logs/metrics remain the current tooling (per §69) — no external
observability vendor has been evaluated as necessary, and none is added this pass. Logging volume
is trivially low at current traffic (8 scans/30 days) — no sampling or volume-limiting
configuration change is needed (§71).

## Cadence

Capacity/reliability review happens at the triggers defined in `CLOUDFLARE_UPGRADE_TRIGGERS.md`
and as part of the monthly review (`docs/governance/PHASE_19_CONTINUOUS_REVIEW_CADENCE.md`), not
on a fixed independent schedule.
