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
