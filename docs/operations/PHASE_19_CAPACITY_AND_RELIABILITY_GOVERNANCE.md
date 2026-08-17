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

## RISK-033 / preview Lighthouse discrepancy — classification (§79-80), corrected 2026-08-15

**This section previously classified the preview Lighthouse budget's repeated failures as a
"preview-specific environmental difference, not a production regression," reasoning that
production's own Phase 11 measurement (94-99 score, 1,579-2,940ms LCP) contradicted a genuine
regression theory. That classification was wrong and is corrected here** — it was written without
ever actually running the controlled production/preview/local comparison this section itself said
was needed before trusting it (the prior text explicitly flagged this as unproven).

That comparison was run 2026-08-15 (see `docs/risks/ACTIVE_RISKS.md`'s RISK-033 entry for full
detail): production was measured twice (7 runs across 6 pages) and the live preview Worker once.
**The homepage specifically fails badly and consistently in both environments** — production: 5 of
7 runs scored 71-75 with LCP 5,670-6,332ms; preview: 74/100, LCP 6,055ms. Every other page tested
(pricing, sample-report, crawler detail, `/for/agencies`, `/platforms/cloudflare`) is fine in both
environments (92-100/100, LCP 1,528-2,634ms), matching Phase 11's baseline for those pages.

**Corrected classification: a real, currently-active, homepage-specific defect present in both
preview and production — not a preview-only environmental artifact.** The two things previously
treated as separate (the recurring preview CI failures, and Phase 11's "production is fine"
finding) are the same defect; Phase 11's evidence just never happened to catch the homepage in its
slow state, or something changed since Phase 11 that specifically affects the homepage. Root cause
is not yet confirmed — render-blocking scripts were ruled out (none exist on the homepage); the
leading unconfirmed hypothesis is the homepage's hero `AuditForm` React island (the only
structural difference from every other tested page) delaying paint during hydration. The preview
CI threshold is still **not** being lowered (§80 stands) — if anything, this raises the stakes,
since the preview gate was correctly catching a real problem the whole time.

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
