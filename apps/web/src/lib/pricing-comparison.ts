import type { PricingPlanEntry } from "../components/PricingPlans";

/**
 * Phase 19 pricing-comparison presentation metadata (§33 of the Phase 19 pricing-comparison
 * prompt). This module owns section ordering, row labels/descriptions and formatting only — it
 * must never store a plan-specific entitlement value. Every `cell()` function below reads its
 * answer from the `PricingPlanEntry` passed in (itself sourced from `getPlanCatalog()` ->
 * `getPlan()` -> D1 `plans`, see plan-catalog.ts) so this file cannot drift from the real
 * entitlement source of truth.
 */

export type ComparisonCell =
  { kind: "included" } | { kind: "not-included" } | { kind: "value"; text: string };

export type ComparisonRow = {
  key: string;
  label: string;
  description?: string;
  /** True for rows that are the same "Included" answer on every plan by product design (§34) — not a plan entitlement, a product invariant. */
  universal?: boolean;
  cell: (plan: PricingPlanEntry) => ComparisonCell;
};

export type ComparisonSection = {
  id: string;
  heading: string;
  caption: string;
  scrollRegionLabel: string;
  rows: ComparisonRow[];
};

function includedCell(value: boolean): ComparisonCell {
  return value ? { kind: "included" } : { kind: "not-included" };
}

function universalRow(label: string, description?: string): ComparisonRow {
  return { key: label, label, description, universal: true, cell: () => ({ kind: "included" }) };
}

/** Comparison-table wording for monitoring frequency (§15) — distinct from the more compact
 * plan-card wording ("Monthly monitoring"), which stays as already approved by Phase 6 (§36). */
export function formatAutomaticMonitoring(
  frequency: PricingPlanEntry["monitoringFrequency"],
): string {
  switch (frequency) {
    case "none":
      return "No automatic monitoring";
    case "monthly":
      return "Monthly";
    case "weekly":
      return "Weekly";
  }
}

/**
 * Audit-history retention label from the raw day count. Deliberately avoids `days / 30` (the
 * previous single-table implementation's approach): for Free's 30 days that rounds to 1 month —
 * `Math.round(30 / 30) === 1` — which read as "1 month" instead of the correct "30 days", and for
 * Agency's 1095 days it rounds to 37 months — `Math.round(1095 / 30) === 37`, since 1095 / 30 is
 * exactly 36.5 and `Math.round` breaks ties up — instead of the correct 36 months. Retention
 * values below one month are shown as days; at or above one month, `days * 12 / 365` recovers the
 * exact whole-year month count (12/24/36) because the stored day values are whole years (365 ×
 * N), not `30 × N`.
 */
export function formatHistoryRetention(days: number): string {
  if (days < 60) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.round((days * 12) / 365);
  return `${months} month${months === 1 ? "" : "s"}`;
}

function formatBatchImport(limit: number): ComparisonCell {
  return limit > 0 ? { kind: "value", text: `Up to ${limit}` } : { kind: "not-included" };
}

export function formatUsdCents(cents: number): string {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

/** Same commercial value shown in the plan cards — never a second price source (§25). */
export function planPriceLabel(plan: PricingPlanEntry, interval: "month" | "year"): string {
  if (plan.id === "free") return "$0";
  const cents = interval === "month" ? plan.monthlyCents! : plan.yearlyCents!;
  return `$${formatUsdCents(cents)}/${interval === "month" ? "month" : "year"}`;
}

export const COMPARISON_SECTIONS: ComparisonSection[] = [
  {
    id: "core-audit",
    heading: "Core audit & reports",
    caption: "Core audit and report features by plan",
    scrollRegionLabel: "Core audit and report features, scrollable table comparing all plans",
    rows: [
      universalRow("Complete AI crawler policy audit"),
      universalRow("AI crawler matrix by purpose"),
      universalRow("Evidence-based findings"),
      universalRow("Deterministic recommendations"),
      universalRow(
        "All supported policy signals",
        "robots.txt, llms.txt, RSL and related public policy signals — see /methodology.",
      ),
      universalRow("Print-friendly reports"),
      universalRow("Private, revocable report sharing"),
    ],
  },
  {
    id: "domains-history-monitoring",
    heading: "Domains, history & monitoring",
    caption: "Domain, history and monitoring limits by plan",
    scrollRegionLabel:
      "Domain, history and monitoring limits, scrollable table comparing all plans",
    rows: [
      {
        key: "saved-domains",
        label: "Saved domains",
        cell: (plan) => ({ kind: "value", text: String(plan.savedDomainLimit) }),
      },
      {
        key: "monitoring",
        label: "Automatic monitoring",
        cell: (plan) => ({
          kind: "value",
          text: formatAutomaticMonitoring(plan.monitoringFrequency),
        }),
      },
      {
        key: "rescans",
        label: "Manual rescans per domain / month",
        description: "Additional manual scans available for each saved domain.",
        cell: (plan) => ({ kind: "value", text: String(plan.manualRescansPerDomainPerMonth) }),
      },
      {
        key: "history",
        label: "Audit history",
        cell: (plan) => ({
          kind: "value",
          text: formatHistoryRetention(plan.historyRetentionDays),
        }),
      },
      {
        key: "atom-feed",
        label: "Private Atom change feed",
        description: "Follow policy changes in a private feed.",
        cell: (plan) => includedCell(plan.privateAtomFeedEnabled),
      },
    ],
  },
  {
    id: "portfolio-workflows",
    heading: "Portfolio workflows",
    caption: "Portfolio workflow features by plan",
    scrollRegionLabel: "Portfolio workflow features, scrollable table comparing all plans",
    rows: [
      {
        key: "domain-groups",
        label: "Domain groups",
        description: "Organize saved domains into portfolio groups.",
        cell: (plan) => includedCell(plan.domainGroupsEnabled),
      },
      {
        key: "csv-export",
        label: "CSV domain export",
        cell: (plan) => includedCell(plan.csvExportEnabled),
      },
      {
        key: "batch-import",
        label: "Batch domain import",
        cell: (plan) => formatBatchImport(plan.batchImportLimit),
      },
    ],
  },
  {
    id: "agency",
    heading: "Agency capabilities",
    caption: "Agency features by plan",
    scrollRegionLabel: "Agency features, scrollable table comparing all plans",
    rows: [
      {
        key: "agency-branding",
        label: "Agency-branded shared reports",
        description: "Add your Agency branding to client-facing shared reports.",
        cell: (plan) => includedCell(plan.agencyBrandingEnabled),
      },
    ],
  },
];

/** §52: substrings the Pricing page must never advertise. Checked in pricing-comparison.test.ts
 * against every row label/description; also useful as a manual grep target for page copy. */
export const FORBIDDEN_PRICING_TERMS = [
  "trial",
  "no credit card",
  "daily monitoring",
  "real-time monitoring",
  "hourly monitoring",
  "unlimited domain",
  "client portal",
  "team seat",
  "per-user",
  "per user",
  "usage credit",
  "overage",
  "portfolio risk",
  "cross-domain comparison",
  "policy preset",
  "lifetime plan",
  "setup fee",
];
