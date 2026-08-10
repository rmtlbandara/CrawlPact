# Product Metric Dictionary

**Level 2 document.** Phase 13. Precise definitions for every metric shown in the Super Admin
product-analytics dashboard (`/admin/analytics`, `apps/web/src/lib/admin/product-analytics.ts`).

| Metric                            | Exact definition                                                                                                | Source                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Total accounts                    | `count(*)` from `users` where `deleted_at IS NULL`                                                              | `users`                                                                                |
| Activated accounts                | `count(distinct owner_user_id)` from `domains` where `last_scan_id IS NOT NULL` and not deleted                 | `domains`                                                                              |
| Active paid accounts              | `count(*)` from `subscriptions` where `status IN ('active','trialing')`                                         | `subscriptions`                                                                        |
| Monitored domains                 | `count(*)` from `domains` where `monitoring_state = 'active'` and not deleted                                   | `domains`                                                                              |
| WAU                               | Distinct `product_events.user_id` (non-null) with a row in the last 7 days                                      | `product_events`                                                                       |
| MAU                               | Same, last 30 days                                                                                              | `product_events`                                                                       |
| Audit → saved-domain conversion   | `domain_saved` events ÷ `audit_started` events, in range                                                        | `product_events`                                                                       |
| Audit funnel rates                | See `CRAWLPACT_PRODUCT_MEASUREMENT_STRATEGY.md` "Audit funnel"                                                  | `product_events`                                                                       |
| Accounts with a baseline          | Activated accounts ÷ total accounts                                                                             | `domains`, `users`                                                                     |
| Monitoring enabled (of activated) | Accounts with `monitoring_state='active'` domain ÷ activated accounts                                           | `domains`                                                                              |
| Retention (simplified)            | Accounts created in range who also have a `product_events` row in the last 30 days, ÷ accounts created in range | `users`, `product_events` — see the strategy doc's disclosed limitation                |
| Active subscriptions by plan      | `group by plan_id` on `subscriptions` where status active/trialing                                              | `subscriptions`                                                                        |
| Estimated MRR                     | Σ(plan's `annual_price_usd_cents` ÷ 12 × active-subscription-count for that plan)                               | `subscriptions`, `plans` — explicitly labelled "estimated," not Paddle-reconciled      |
| Agency adoption metrics           | See the strategy doc's "Agency adoption" section                                                                | `users`, `domains`, `portfolio_import_jobs`, `product_events`, `agency_brand_profiles` |
| Measurement health — last event   | `max(created_at)` from `product_events`                                                                         | `product_events`                                                                       |
| Measurement health — events (24h) | `count(*)` from `product_events` where `created_at >= now - 24h`                                                | `product_events`                                                                       |
| Consent granted/declined (30d)    | `count(*)` of `analytics_consent_granted`/`analytics_consent_declined` events in the last 30 days               | `product_events`                                                                       |

## Low-volume presentation rule

Every ratio metric is presented as `numerator / denominator — percent%`; a zero denominator
renders "Insufficient historical data" rather than an undefined or misleading percentage. No
metric here is ever derived from Google Analytics.
