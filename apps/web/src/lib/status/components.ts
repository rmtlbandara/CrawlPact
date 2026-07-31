/**
 * The fixed, canonical list of customer-facing components an incident can
 * affect. Shared by the admin incident form and the public status page so
 * the two can never drift into different label text for the same key — see
 * docs/architecture/INCIDENT_TRACKING_SYSTEM_DESIGN.md §5.
 */
export const STATUS_COMPONENTS = [
  { key: "website", label: "Website and public pages" },
  { key: "audit_scanner", label: "Audit and scanner" },
  { key: "accounts_passkeys", label: "Accounts and passkeys" },
  { key: "dashboard_domains", label: "Dashboard and saved domains" },
  { key: "scheduled_monitoring", label: "Scheduled monitoring" },
  { key: "reports_sharing", label: "Reports and sharing" },
  { key: "billing_checkout", label: "Billing and checkout" },
] as const;

export type StatusComponentKey = (typeof STATUS_COMPONENTS)[number]["key"];

export function isStatusComponentKey(value: string): value is StatusComponentKey {
  return STATUS_COMPONENTS.some((c) => c.key === value);
}

export function statusComponentLabel(key: string): string {
  return STATUS_COMPONENTS.find((c) => c.key === key)?.label ?? key;
}
