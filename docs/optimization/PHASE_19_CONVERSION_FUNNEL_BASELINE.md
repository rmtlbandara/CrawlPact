# Phase 19 Conversion Funnel Baseline

Status: current-authoritative, 2026-08-14. Recorded before any conversion-optimisation change, so
future improvement can actually be measured against a real starting point (§129).

## Funnel (all-time, non-admin/external activity only)

| Stage                             | Count         | % of previous stage      | Note                                                                                                                                                                            |
| --------------------------------- | ------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Homepage/landing visitors         | Not available | —                        | Requires Search Console/GA aggregate pageview data beyond this session's direct D1 access; GA is consent-gated per Phase 13 and reports aggregate, not queryable from this pass |
| Anonymous audit starts            | 1             | —                        | `scans.triggered_by = 'anonymous'`                                                                                                                                              |
| Anonymous audit completes         | 1             | 100% (1/1)               | `status IN ('completed','completed_with_warnings')`                                                                                                                             |
| Account conversions (non-admin)   | 1             | —                        | Total non-admin accounts ever created; cannot confirm this specific account converted from the 1 anonymous audit above without session-level joins beyond this baseline's scope |
| Saved baselines (non-admin)       | 0             | 0% (0/1 accounts)        | The 1 non-admin account has 0 saved domains                                                                                                                                     |
| Monitoring enablement (non-admin) | 0             | 0% (0/0 saved baselines) | Denominator is 0 — stated explicitly per §33 ("where a denominator is unavailable, state that")                                                                                 |
| Pricing views (non-admin)         | Not available | —                        | Not currently instrumented as a distinct queryable `product_events` type in this baseline pass                                                                                  |
| Checkout starts (non-admin)       | 0             | —                        | 0 non-admin billing customers exist                                                                                                                                             |
| Payments (non-admin)              | 0             | 0%                       | Confirmed via `subscriptions`/`billing_customers` join                                                                                                                          |

## Honest limitations of this baseline

- Top-of-funnel (raw visitor count) is not derivable from this session's direct database access —
  it lives in Google Analytics (consent-gated, aggregate-only) and would require either the GA
  reporting API (not connected) or Search Console (not connected, see the Search Console
  baseline). This gap is disclosed, not filled with an estimate.
- Pricing-view tracking exists as `product_events` in the codebase but this baseline did not
  enumerate its exact event-type string against live data — a future pass should confirm the
  precise `product_events.type` value used and re-run this query with it populated.
- With only 1 non-admin account and 0 saved domains, every percentage below "audit completes" is
  either 0% or undefined-denominator. This is expected at the current real-usage level, not a
  measurement failure.

## Conclusion

The funnel confirms the same fact as the post-launch baseline from a different angle: genuine
external usage is effectively zero. The most valuable near-term Phase 19 work is not funnel
micro-optimisation (there is no meaningful sample to optimise against yet) — it is obtaining real
external traffic and participants in the first place, which is a recruitment/commercial-validation
problem, not a conversion-rate problem.
