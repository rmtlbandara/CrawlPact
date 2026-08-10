# CrawlPact Product Measurement Strategy

**Level 2 document.** Phase 13. Defines what "product success" means in measurable terms, using
first-party `product_events` and authoritative billing/domain state as the source of truth — never
Google Analytics (see `docs/analytics/GOOGLE_ANALYTICS_SCOPE_POLICY.md`).

## North Star metric

**Active monitored domains with a successfully established baseline and valid monitoring state**
(`executiveSummary.monitoredDomains` in the Super Admin dashboard) — a domain with
`monitoring_state = 'active'`, not a total-registrations or page-view count, because it directly
represents ongoing product value delivered (CrawlPact watching a real site's AI-crawler policy for
drift), not a vanity signup number. Reported alongside the associated active-account count, since
a North Star with no account context can hide concentration in a small number of power accounts.

## Acquisition

First-party aggregate counts (`landing_viewed`, `audit_started`, `pricing_viewed`) in the selected
date range, plus consented Google Analytics for marketing-page traffic/organic trends. No
cross-site attribution is fabricated when GA consent is absent — the dashboard shows only what was
actually measured, disclosing the gap rather than inventing a number.

## Audit funnel

```
landing → audit_started → audit_completed → result_viewed → account_created → domain_saved
```

Reported rates: completion rate, result-view rate, result→signup rate, signup→saved-domain rate,
each as `N / D — P%`, never a bare percentage (see "Low-volume data" below).

## Activation

Recommended definition: an account with at least one successfully established saved-domain
baseline (`lastScanId IS NOT NULL`). Stronger definition also tracked: an eligible account with
monitoring successfully enabled for at least one domain. Both reported.

## Engagement

Domain opened, timeline viewed, rescan used, report shared — meaningful actions, not page views.

## WAU / MAU

Unique accounts (`userId IS NOT NULL`) with at least one `product_events` row in the last 7 / 30
days. Every `trackEvent()` call site is a real, human-triggered request handler — cron, webhook,
and automated-scan code paths never call `trackEvent()` — so no separate "is this automated"
filter is needed on top of the `userId IS NOT NULL` condition.

## Retention (simplified)

Full cohort day-N retention (7/30/90-day cohorts tracked independently over time) was judged out
of scope for this phase's effort budget — it requires either a dedicated cohort-tracking table or
materially more complex windowed SQL than the rest of this dashboard, and CrawlPact's current
volume (a handful of real accounts) would produce cohorts too small to draw meaningful conclusions
from regardless. What's implemented instead: of accounts _created_ within the selected range, what
fraction generated _any_ product event in the last 30 days — a same-period-activity proxy, clearly
labelled "simplified" in the dashboard, not presented as true cohort retention. A follow-up phase
with more real volume should revisit this.

## Conversion

```
pricing_viewed → plan_selected → checkout_opened → subscription_activated
plan_limit_reached → pricing → checkout → subscription_activated
```

Never sent to Google Analytics with an account identifier — first-party records only.

## Revenue

Authoritative from `subscriptions.status`/`planId` (billing truth), never inferred from GA.
Reported: active subscriptions by plan, and an estimated MRR (list-price-derived, clearly labelled
"estimated" — not a Paddle-reconciled figure, and does not account for proration, discounts, or
currency).

## Agency adoption

Agency-plan accounts, accounts using domain groups, accounts using CSV import (from
`portfolio_import_jobs.owner_user_id`, a real persisted job table) and CSV export (from
`product_events`, since no persisted export-job table exists), accounts with agency branding.
Client/group names are never exposed in this aggregate view.

## Reliability metrics stay separate

Monitoring completion, overdue monitoring, audit/platform failure counts remain in
`docs/operations/` (the Phase 11 operational capacity view, `apps/web/src/lib/admin/capacity.ts`)
— this dashboard does not duplicate that operational truth in a second, competing table.

## Measurement limitations (disclosed)

- Retention is a simplified proxy, not full cohort day-N analysis (see above).
- Real volume is currently very low (a handful of accounts) — every ratio is shown as
  `numerator / denominator — percent%`, and a denominator of 0 shows "Insufficient historical
  data," never a misleading bare percentage from a tiny sample.
- No fabricated historical events, no backfilled activity, no invented growth trend — when history
  doesn't exist, the dashboard says so rather than showing zero silently or interpolating.
- GA's own historical data (pre-consent-gating) and post-consent data are discontinuous — the
  consent architecture went live on the date recorded in
  `docs/reports/PHASE_13_ANALYTICS_CONSENT_PRODUCT_MEASUREMENT_COMPLETION_REPORT.md`; trend
  analysis spanning that date should disclose the discontinuity, not silently merge the two
  periods.
