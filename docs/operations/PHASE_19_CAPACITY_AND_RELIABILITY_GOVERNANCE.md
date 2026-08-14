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

## RISK-033 / preview Lighthouse discrepancy — classification (§79-80)

The preview environment's Lighthouse budget has failed twice on unrelated commits (baseline
`352a4f8` and the Phase 0-18 reconfirmation's `16fb160`) with near-identical numbers each time
(score ~82 vs. 85 threshold, LCP ~4980ms vs. 3000ms threshold), while production's own measured
Lighthouse evidence (Phase 11: 94-99 score, 1,579-2,940ms LCP) remains far above threshold and is
the number that reflects real customer experience.

**Classification: preview-specific environmental difference, not a production regression.** The
repeatability across two unrelated commits with no shared code change strongly suggests a
preview-Worker cold-start or CI-runner network characteristic, not a real page-weight issue —
production's own measurement contradicts a genuine regression theory. This is not yet proven with
a controlled side-by-side (production vs. preview vs. local built Worker under comparable
conditions, per §79) — that measurement is logged as an evidence-backlog item
(`docs/optimization/PHASE_19_EVIDENCE_BACKLOG.md`) rather than performed speculatively in this
pass, and the preview CI threshold is **not** being lowered without that evidence (§80).

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
