# Phase 19 Product and Commercial Metric Dictionary

Status: current-authoritative, 2026-08-14. Defines every metric Phase 19 uses, so definitions
stay stable rather than being casually redefined (§113-114). Metrics are derived from existing
authoritative tables (`product_events`, `domains`, `scans`, `subscriptions`, `billing_customers`)
per §154 — no duplicate metrics tables exist or are planned.

## Internal-account exclusion (applies to every metric below)

Every "external" metric excludes `users.is_admin = 1` and any account otherwise known to be
owner/team-controlled. As of this baseline, that means excluding the single Super Admin account
(`a282ef8c-...`) from all commercial/acquisition/activation conclusions.

## Acquisition

| Metric                     | Definition                                                                                 | Source                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Organic impressions/clicks | Search Console aggregate data                                                              | Not available — see `PHASE_19_SEARCH_CONSOLE_BASELINE.md` |
| Anonymous audit starts     | Count of `scans` where `triggered_by = 'anonymous'`                                        | `scans` table                                             |
| Audit completion           | Count of `scans` where `status IN ('completed', 'completed_with_warnings')` / audit starts | `scans` table                                             |

## Activation

| Metric                | Definition                                                                |
| --------------------- | ------------------------------------------------------------------------- |
| Account conversion    | Non-admin `users` created / anonymous audit starts (same session)         |
| Saved baseline        | Non-admin `domains.deleted_at IS NULL` count per account                  |
| Monitoring enablement | Non-admin domains with `monitoring_frequency != 'none'` / saved baselines |

## Commercial

| Metric          | Definition                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pricing view    | `product_events` of the pricing-page-view type, non-admin actor                                                                                                                |
| Checkout start  | `product_events` of the checkout-start type, non-admin actor                                                                                                                   |
| Paid conversion | Non-admin `subscriptions.status = 'active'` count                                                                                                                              |
| MRR             | Sum of active non-admin subscriptions' plan price, normalized to monthly (annual ÷ 12) — Paddle/`plan_prices` is the only source, never a pricing-view or checkout-start count |
| Plan mix        | Distribution of non-admin `subscriptions.plan_id`                                                                                                                              |

## Engagement / Retention

| Metric                     | Definition                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Human return               | A non-admin account's authenticated session on a day after their account-creation day |
| 7/14/30-day engaged return | Human return within N days of account creation                                        |
| Timeline view              | `product_events` for the domain-change-timeline view type                             |
| Rescan                     | Manual (`triggered_by = 'manual'`) scan by a non-admin actor                          |
| Report sharing             | A `shared_reports` row created by a non-admin actor                                   |

## Reliability

| Metric             | Definition                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| Audit success rate | `scans.status = 'completed'` / total non-cancelled scans                                                     |
| Platform failure   | A scan failure attributable to CrawlPact (not `target_unavailable`) — see `PLATFORM_VS_TARGET_FAILURE` below |
| Monitoring overdue | `domains.next_scan_at < now()` for domains with `monitoring_frequency != 'none'`                             |

## Platform vs. target failure (§68)

A scan with `error_category` indicating the customer's own site was unreachable, timed out, or
returned an error is a **target failure**, never counted as a CrawlPact platform outage. Only
`internal_failure` and unexpected `blocked_for_safety`/`rate_limited` outcomes on a legitimate
target count as platform failures. This distinction already exists in the `scans.status` enum
(`target_unavailable` vs `internal_failure`) — this dictionary just names the reporting rule.

## Support burden

| Metric                  | Definition                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| Human intervention rate | Admin-initiated `admin_audit_logs` actions targeting a non-admin account / active non-admin accounts |

## Authority

| Metric                   | Definition                                                              |
| ------------------------ | ----------------------------------------------------------------------- |
| Indexed useful pages     | Search Console indexed-page count (not available yet)                   |
| Registry freshness       | Days since `registry_versions.published_at` for the active release      |
| Observatory publications | Count of published rows in the research-publication table (currently 0) |

## Metric change log

Empty as of this baseline. Any future redefinition must append an entry here with: old
definition, new definition, reason, effective date, historical comparability impact (§114).
