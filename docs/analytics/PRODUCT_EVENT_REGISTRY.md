# Product Event Registry

**Level 2 document.** The authoritative list of every event `trackEvent()` (`apps/web/src/lib/analytics.ts`)
can write to `product_events`. This is a first-party, aggregate product-measurement system — not a
general logging sink and not the SRS §33 operational-telemetry system (see `apps/web/src/lib/data-retention.ts`
and `docs/operations/` for that). See `docs/analytics/CRAWLPACT_PRODUCT_MEASUREMENT_STRATEGY.md` for
how these feed the North Star/funnel/retention metrics, and `docs/analytics/ANALYTICS_DATA_FLOW.md`
for the write path.

## Global rules (apply to every event below)

- **Anonymous/authenticated**: `userId` is set whenever a session exists, otherwise `null`. No
  long-lived anonymous identifier is generated (`anonymousId` remains an unused, reserved column
  — see `docs/analytics/CONSENT_AND_ANALYTICS_PREFERENCE_MODEL.md` "Anonymous analytics").
- **Prohibited properties** (enforced at runtime, `apps/web/src/lib/analytics.ts`'s
  `PROHIBITED_PROPERTY_KEY_PATTERN` — any property key matching `email`, `domain`, `url`, `token`,
  `ip`, `useragent`, `password`, `secret`, `ssn`, `credit card` throws and is rejected, regardless
  of event): full domain, full URL, email, IP, raw User-Agent, passkey information, session ID,
  authentication token, audit continuation token, feed token, share token, Paddle customer ID,
  subscription ID, transaction ID, raw crawler evidence, robots.txt content, uploaded CSV
  contents, client name, group name, agency note, support communication.
- **Allowed properties**: low-cardinality enums/counts/categories only (e.g. `plan`, `trigger`,
  `status`, `resultCategory`, `interval`, `reason`, `filter`) — every existing call site was
  audited during Phase 13 and confirmed to only ever pass this shape (no PII-shaped key found
  across the 46 call sites that existed at the time).
- **Retention**: 18 months from `createdAt`, purged by `purgeExpiredProductEvents`
  (`apps/web/src/lib/data-retention.ts`), part of the same daily retention cron as every other
  category — see `docs/analytics/PHASE_13_PRODUCT_EVENT_RETENTION_DECISION.md`.
- **Test coverage**: `apps/web/tests/integration/analytics-event-validation.integration.test.ts`
  (real-D1 property validation, including 11 synthetic PII-shaped-key rejection cases),
  `apps/web/tests/integration/product-analytics.integration.test.ts` (aggregation correctness),
  `apps/web/tests/integration/analytics-sharing.integration.test.ts` and other per-phase
  integration suites (individual event write paths). The 200-char string-property cap and
  unknown-event-name rejection are enforced by `POST /api/analytics/track`'s Zod schema, one layer
  above `trackEvent()` itself.

## Acquisition / homepage (Phase 4)

| Event                                | Trigger                                   | Purpose                  |
| ------------------------------------ | ----------------------------------------- | ------------------------ |
| `landing_viewed`                     | Homepage rendered                         | Acquisition volume       |
| `sample_report_clicked`              | Homepage "sample report" link clicked     | Content-conversion path  |
| `homepage_pricing_clicked`           | Homepage pricing CTA clicked              | Conversion path          |
| `homepage_agency_cta_clicked`        | Homepage agency CTA clicked               | Conversion path          |
| `homepage_methodology_clicked`       | Homepage methodology link clicked         | Trust/content engagement |
| `homepage_crawler_directory_clicked` | Homepage crawler-directory link clicked   | Content engagement       |
| `crawler_reference_page_opened`      | A public crawler-reference page is opened | Content engagement       |

## Audit / anonymous-conversion funnel (Phase 5)

See `docs/analytics/PHASE_05_AUDIT_CONVERSION_EVENT_MODEL.md` for full detail.

| Event                                 | Trigger                                             | Purpose                              |
| ------------------------------------- | --------------------------------------------------- | ------------------------------------ |
| `audit_started`                       | Anonymous or authenticated audit request accepted   | Audit funnel                         |
| `audit_completed`                     | Audit finished successfully                         | Audit funnel                         |
| `audit_failed`                        | Audit finished unsuccessfully                       | Audit funnel / reliability signal    |
| `result_viewed`                       | Audit result page rendered                          | Audit funnel                         |
| `account_started`                     | Account-creation ceremony begun from a report       | Conversion funnel                    |
| `account_created`                     | Account created                                     | Conversion funnel                    |
| `domain_saved`                        | A domain saved to an account                        | Conversion funnel / North Star input |
| `anonymous_conversion_cta_viewed`     | Conversion CTA shown on an anonymous result         | Conversion funnel                    |
| `anonymous_conversion_cta_clicked`    | Conversion CTA clicked                              | Conversion funnel                    |
| `audit_continuation_expired`          | A save-flow continuation expired unused             | Funnel-loss diagnostic               |
| `audit_domain_save_started`           | Domain-save step of the conversion flow begun       | Conversion funnel                    |
| `audit_baseline_adopted`              | The anonymous scan adopted as the domain's baseline | Activation                           |
| `audit_baseline_rerun_started`        | A fresh baseline scan started instead of adopting   | Activation                           |
| `audit_baseline_rerun_completed`      | That fresh baseline scan completed                  | Activation                           |
| `monitoring_setup_viewed`             | Monitoring opt-in step shown                        | Activation funnel                    |
| `monitoring_enabled`                  | Monitoring enabled during conversion                | Activation / North Star input        |
| `monitoring_skipped`                  | Monitoring opt-in skipped                           | Activation funnel                    |
| `audit_conversion_plan_limit_reached` | Plan's saved-domain limit hit during conversion     | Conversion-loss diagnostic           |
| `audit_conversion_completed`          | Full conversion flow completed                      | Conversion funnel                    |
| `audit_conversion_failed`             | Conversion flow failed                              | Conversion-loss diagnostic           |

## Billing (Phase 6)

See `docs/billing/PHASE_06_BILLING_EVENT_MODEL.md` for full detail.

| Event                       | Trigger                                          | Purpose                              |
| --------------------------- | ------------------------------------------------ | ------------------------------------ |
| `pricing_viewed`            | Pricing page rendered                            | Conversion funnel                    |
| `checkout_started`          | Checkout initiation begun                        | Conversion funnel                    |
| `billing_interval_selected` | Monthly/annual toggle changed                    | Conversion funnel                    |
| `plan_selected`             | A plan chosen on the pricing page                | Conversion funnel                    |
| `checkout_opened`           | Paddle checkout overlay opened                   | Conversion funnel                    |
| `checkout_failed`           | Checkout failed to open/complete                 | Conversion-loss diagnostic           |
| `subscription_activated`    | A subscription became active (webhook-confirmed) | Conversion funnel / North Star input |
| `plan_change_previewed`     | A plan/interval change preview requested         | Billing engagement                   |
| `plan_change_confirmed`     | A plan/interval change confirmed                 | Billing engagement                   |
| `plan_change_failed`        | A plan/interval change failed                    | Reliability diagnostic               |
| `customer_portal_opened`    | Paddle customer portal opened                    | Billing engagement                   |

## Content / SEO (Phase 7)

| Event                              | Trigger                                       | Purpose                  |
| ---------------------------------- | --------------------------------------------- | ------------------------ |
| `vertical_page_viewed`             | An audience-vertical landing page rendered    | Acquisition              |
| `vertical_audit_cta_clicked`       | Audit CTA clicked on a vertical page          | Conversion path          |
| `vertical_sample_report_clicked`   | Sample-report link clicked on a vertical page | Conversion path          |
| `vertical_pricing_clicked`         | Pricing link clicked on a vertical page       | Conversion path          |
| `platform_guide_viewed`            | A platform guide page rendered                | Acquisition              |
| `platform_audit_cta_clicked`       | Audit CTA clicked on a platform guide         | Conversion path          |
| `platform_official_source_clicked` | An official-source citation link clicked      | Content trust engagement |
| `platform_related_guide_clicked`   | A related-guide link clicked                  | Content engagement       |
| `content_correction_clicked`       | The "report a correction" link clicked        | Content-quality feedback |

## Saved-domain experience (Phase 8)

See `docs/analytics/PHASE_08_SAVED_DOMAIN_EVENT_MODEL.md` for full detail.

| Event                          | Trigger                                    | Purpose                         |
| ------------------------------ | ------------------------------------------ | ------------------------------- |
| `saved_domains_viewed`         | The saved-domains list rendered            | Engagement                      |
| `saved_domain_opened`          | A single domain's detail page opened       | Engagement                      |
| `domain_current_state_viewed`  | A domain's current-state summary viewed    | Engagement                      |
| `domain_change_summary_viewed` | A domain's change summary viewed           | Engagement                      |
| `domain_timeline_viewed`       | A domain's change timeline viewed          | Engagement                      |
| `domain_timeline_filtered`     | The timeline filter applied                | Engagement                      |
| `domain_change_event_opened`   | A single timeline event opened             | Engagement                      |
| `domain_comparison_opened`     | A scan-to-scan comparison opened           | Engagement                      |
| `domain_evidence_opened`       | Raw scan evidence opened                   | Engagement                      |
| `domain_scan_history_viewed`   | A domain's scan history viewed             | Engagement                      |
| `domain_rescan_started`        | A manual rescan started                    | Engagement                      |
| `domain_rescan_completed`      | That rescan completed                      | Engagement / reliability signal |
| `domain_rescan_failed`         | That rescan failed                         | Reliability diagnostic          |
| `domain_monitoring_enabled`    | Monitoring enabled for an existing domain  | Monitoring adoption             |
| `domain_monitoring_disabled`   | Monitoring disabled for an existing domain | Monitoring adoption             |
| `domain_share_started`         | Report-share flow started                  | Sharing                         |
| `domain_report_printed`        | Print-ready report view opened             | Engagement                      |
| `domain_retention_info_viewed` | History-retention info viewed              | Engagement                      |

## Agency workspace (Phase 9)

See `docs/analytics/PHASE_09_AGENCY_WORKSPACE_EVENT_MODEL.md` for full detail.

| Event                                | Trigger                                 | Purpose                    |
| ------------------------------------ | --------------------------------------- | -------------------------- |
| `agency_workspace_viewed`            | Agency workspace rendered               | Agency adoption            |
| `portfolio_summary_viewed`           | Portfolio summary viewed                | Agency engagement          |
| `portfolio_attention_filter_applied` | Attention filter applied                | Agency engagement          |
| `portfolio_change_feed_viewed`       | Portfolio change feed viewed            | Agency engagement          |
| `portfolio_domain_opened`            | A domain opened from the portfolio view | Agency engagement          |
| `domain_group_created`               | A domain group created                  | Agency adoption            |
| `domain_group_updated`               | A domain group updated                  | Agency engagement          |
| `domain_group_deleted`               | A domain group deleted                  | Agency engagement          |
| `domain_group_assignment_changed`    | A domain's group assignment changed     | Agency engagement          |
| `saved_view_created`                 | A saved portfolio view created          | Agency engagement          |
| `portfolio_import_previewed`         | CSV import preview requested            | Agency adoption            |
| `portfolio_import_confirmed`         | CSV import confirmed                    | Agency adoption            |
| `portfolio_import_completed`         | CSV import completed                    | Agency adoption            |
| `portfolio_import_failed`            | CSV import failed                       | Reliability diagnostic     |
| `portfolio_export_started`           | CSV export started                      | Agency adoption            |
| `portfolio_export_completed`         | CSV export completed                    | Agency adoption            |
| `bulk_action_started`                | A bulk action started                   | Agency engagement          |
| `bulk_action_completed`              | That bulk action completed              | Agency engagement          |
| `agency_branding_updated`            | Agency branding profile updated         | Agency adoption            |
| `agency_logo_uploaded`               | Agency logo uploaded                    | Agency adoption            |
| `agency_logo_removed`                | Agency logo removed                     | Agency engagement          |
| `agency_report_share_created`        | A branded report share created          | Agency adoption            |
| `agency_report_share_revoked`        | A branded report share revoked          | Agency engagement          |
| `plan_limit_reached_from_portfolio`  | Plan limit hit from the portfolio view  | Conversion-loss diagnostic |

## Notifications and monitoring reliability (Phase 10)

See `docs/analytics/PHASE_10_NOTIFICATION_EVENT_MODEL.md` for full detail.

| Event                           | Trigger                               | Purpose                    |
| ------------------------------- | ------------------------------------- | -------------------------- |
| `notifications_viewed`          | Notification centre opened            | Engagement                 |
| `notification_marked_read`      | A notification marked read            | Engagement                 |
| `notifications_marked_all_read` | All notifications marked read         | Engagement                 |
| `notification_filter_applied`   | Notification filter applied           | Engagement                 |
| `notification_deep_link_opened` | A notification's deep link opened     | Engagement                 |
| `notification_opened`           | A notification opened (general)       | Engagement                 |
| `atom_feed_created`             | Private Atom feed token created       | Engagement                 |
| `atom_feed_regenerated`         | Atom feed token regenerated           | Engagement                 |
| `atom_feed_revoked`             | Atom feed token revoked               | Engagement                 |
| `atom_feed_entitlement_blocked` | Atom feed blocked by plan entitlement | Conversion-loss diagnostic |
| `monitoring_paused_viewed`      | Paused-monitoring state viewed        | Reliability engagement     |
| `monitoring_resume_started`     | Monitoring-resume flow started        | Reliability engagement     |
| `monitoring_resume_completed`   | Monitoring resumed                    | Reliability engagement     |
| `report_shared`                 | A report share created (general)      | Sharing                    |

## Analytics consent (Phase 13)

See `docs/analytics/CONSENT_AND_ANALYTICS_PREFERENCE_MODEL.md` for full detail. Aggregate counters
only — never a cookie value, IP, or any visitor identifier as a property.

| Event                        | Trigger                                       | Purpose            |
| ---------------------------- | --------------------------------------------- | ------------------ |
| `analytics_consent_granted`  | Visitor accepts analytics for the first time  | Measurement health |
| `analytics_consent_declined` | Visitor declines analytics for the first time | Measurement health |
| `analytics_consent_changed`  | Visitor changes an existing choice            | Measurement health |
