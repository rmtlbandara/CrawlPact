# Phase 21 Conversion Funnel Baseline

**Not performed this phase.** Unlike Phase 20 (which was explicitly granted live Google Search
Console, GA4, and CrUX API access for that session), this Phase 21 session had no analytics API
access grant. No conversion-rate figures, funnel drop-off numbers, or GA4-derived claims appear
anywhere in this Phase 21 evidence package or its completion report — consistent with this
project's non-negotiable rule against presenting fabricated or unverified data as a real product
outcome (`CLAUDE.md`).

## What would be needed to do this properly

- Live GA4 Data API access (as Phase 20 had), scoped to the funnel events already defined in
  `apps/web/src/lib/analytics.ts` (`PRODUCT_EVENT_NAMES`) — e.g. audit-form submission → report
  view → "Save and monitor" click → account creation → first paid checkout.
- A defined observation window long enough to be statistically meaningful given current traffic
  volume (Phase 20's GA4 baseline found near-zero external traffic at that point — see
  `docs/baseline/2026-09-08-phase20/GA4_BASELINE.md` — which would also apply here and makes any
  short-window funnel number this early essentially noise, not signal).

## What this phase did instead

The UX fixes in `UX_FINDING_REGISTER.md` are all on the customer/admin retention side (session
management readability, admin table scannability, header layout robustness) rather than the
top-of-funnel anonymous→registered conversion path, so no conversion-path UI was changed this
phase in a way that would need a funnel re-baseline before/after comparison.
