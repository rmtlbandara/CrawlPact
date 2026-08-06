import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

/**
 * First-party product analytics (SRS §33, Part 2 Step 18). No third-party
 * analytics vendor, no external script, no pixel — every event is a
 * single row in `product_events` (packages/database), written directly
 * from server-side request handling wherever possible. `properties` is
 * deliberately shallow, structured data only: never full page HTML, never
 * a session/recovery/API token, never anything that would let this table
 * double as an auth log.
 */
export const PRODUCT_EVENT_NAMES = [
  "landing_viewed",
  "audit_started",
  "audit_completed",
  "audit_failed",
  "result_viewed",
  "account_started",
  "account_created",
  "domain_saved",
  "pricing_viewed",
  "checkout_started",
  "subscription_activated",
  "report_shared",
  "notification_opened",
  "crawler_reference_page_opened",
  // Homepage conversion-path clicks (Phase 4, Homepage Information
  // Architecture and Conversion Redesign) — page-view-style beacons for
  // link/CTA clicks that have no natural server-side mutation to hang
  // tracking off of, matching this file's own existing pattern above.
  "sample_report_clicked",
  "homepage_pricing_clicked",
  "homepage_agency_cta_clicked",
  "homepage_methodology_clicked",
  "homepage_crawler_directory_clicked",
  // Anonymous audit → account-conversion funnel (Phase 5, Anonymous Audit
  // Result and Account-Conversion Flow). No domain, email, continuation
  // token, or scan ID is ever sent as a property — see
  // docs/analytics/PHASE_05_AUDIT_CONVERSION_EVENT_MODEL.md.
  "anonymous_conversion_cta_viewed",
  "anonymous_conversion_cta_clicked",
  "audit_continuation_expired",
  "audit_domain_save_started",
  "audit_baseline_adopted",
  "audit_baseline_rerun_started",
  "audit_baseline_rerun_completed",
  "monitoring_setup_viewed",
  "monitoring_enabled",
  "monitoring_skipped",
  "audit_conversion_plan_limit_reached",
  "audit_conversion_completed",
  "audit_conversion_failed",
  // Pricing, Plan Architecture and Checkout Continuity (Phase 6). No Paddle customer/subscription/
  // transaction ID, email, full domain, price ID, checkout token, or payment detail is ever sent
  // as a property — see docs/billing/PHASE_06_BILLING_EVENT_MODEL.md.
  "billing_interval_selected",
  "plan_selected",
  "checkout_opened",
  "checkout_failed",
  "plan_change_previewed",
  "plan_change_confirmed",
  "plan_change_failed",
  "customer_portal_opened",
  // Vertical Landing Pages and Platform SEO Architecture (Phase 7). No audited domain, email,
  // full URL with private identifiers, or report evidence is ever sent as a property — see
  // docs/analytics/PHASE_07_CONTENT_CONVERSION_EVENT_MODEL.md.
  "vertical_page_viewed",
  "vertical_audit_cta_clicked",
  "vertical_sample_report_clicked",
  "vertical_pricing_clicked",
  "platform_guide_viewed",
  "platform_audit_cta_clicked",
  "platform_official_source_clicked",
  "platform_related_guide_clicked",
  "content_correction_clicked",
  // Saved-Domain Experience and Change Timeline (Phase 8). No domain name,
  // full URL, evidence, scan ID, or timeline-event ID is ever sent as a
  // property — see docs/analytics/PHASE_08_SAVED_DOMAIN_EVENT_MODEL.md.
  "saved_domains_viewed",
  "saved_domain_opened",
  "domain_current_state_viewed",
  "domain_change_summary_viewed",
  "domain_timeline_viewed",
  "domain_timeline_filtered",
  "domain_change_event_opened",
  "domain_comparison_opened",
  "domain_evidence_opened",
  "domain_scan_history_viewed",
  "domain_rescan_started",
  "domain_rescan_completed",
  "domain_rescan_failed",
  "domain_monitoring_enabled",
  "domain_monitoring_disabled",
  "domain_share_started",
  "domain_report_printed",
  "domain_retention_info_viewed",
  // Agency Workspace and Portfolio Workflows (Phase 9). No domain name,
  // client/group name, notes, uploaded row content, file name, import-job
  // ID, share token, user email, Paddle identifier, evidence, or report
  // finding is ever sent as a property — see
  // docs/analytics/PHASE_09_AGENCY_WORKSPACE_EVENT_MODEL.md.
  "agency_workspace_viewed",
  "portfolio_summary_viewed",
  "portfolio_attention_filter_applied",
  "portfolio_change_feed_viewed",
  "portfolio_domain_opened",
  "domain_group_created",
  "domain_group_updated",
  "domain_group_deleted",
  "domain_group_assignment_changed",
  "saved_view_created",
  "portfolio_import_previewed",
  "portfolio_import_confirmed",
  "portfolio_import_completed",
  "portfolio_import_failed",
  "portfolio_export_started",
  "portfolio_export_completed",
  "bulk_action_started",
  "bulk_action_completed",
  "agency_branding_updated",
  "agency_logo_uploaded",
  "agency_logo_removed",
  "agency_report_share_created",
  "agency_report_share_revoked",
  "plan_limit_reached_from_portfolio",
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];

export function isProductEventName(value: string): value is ProductEventName {
  return (PRODUCT_EVENT_NAMES as readonly string[]).includes(value);
}

export async function trackEvent(
  db: Database,
  eventName: ProductEventName,
  fields: {
    userId?: string | null;
    anonymousId?: string | null;
    properties?: Record<string, string | number | boolean>;
  } = {},
): Promise<void> {
  await db.insert(schema.productEvents).values({
    eventName,
    userId: fields.userId ?? null,
    anonymousId: fields.anonymousId ?? null,
    properties: fields.properties ? JSON.stringify(fields.properties) : null,
    createdAt: new Date().toISOString(),
  });
}
