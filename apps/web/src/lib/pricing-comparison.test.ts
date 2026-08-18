import { describe, expect, it } from "vitest";
import type { PricingPlanEntry } from "../components/PricingPlans";
import {
  COMPARISON_SECTIONS,
  FORBIDDEN_PRICING_TERMS,
  formatAutomaticMonitoring,
  formatHistoryRetention,
  planPriceLabel,
} from "./pricing-comparison";

/**
 * Phase 19 pricing-comparison data-truth tests (§50/§51/§52 of the Phase 19 pricing-comparison
 * prompt). Builds the same four plans documented as approved in
 * docs/billing/APPROVED_PRICING_AND_ENTITLEMENT_MATRIX.md and proves the comparison metadata
 * renders their entitlements correctly — with no second, hard-coded entitlement source.
 */

const FREE: PricingPlanEntry = {
  id: "free",
  name: "Free",
  audience: "For a one-time check on a single site.",
  cta: "Scan a website",
  recommended: false,
  savedDomainLimit: 1,
  monitoringFrequency: "none",
  historyRetentionDays: 30,
  manualRescansPerDomainPerMonth: 2,
  domainGroupsEnabled: false,
  csvExportEnabled: false,
  privateAtomFeedEnabled: false,
  batchImportLimit: 0,
  agencyBrandingEnabled: false,
  monthlyCents: null,
  yearlyCents: null,
};

const SOLO: PricingPlanEntry = {
  ...FREE,
  id: "solo",
  name: "Solo",
  savedDomainLimit: 5,
  monitoringFrequency: "monthly",
  historyRetentionDays: 365,
  manualRescansPerDomainPerMonth: 5,
  privateAtomFeedEnabled: true,
  monthlyCents: 900,
  yearlyCents: 8900,
};

const PRO: PricingPlanEntry = {
  ...FREE,
  id: "pro",
  name: "Pro",
  recommended: true,
  savedDomainLimit: 25,
  monitoringFrequency: "weekly",
  historyRetentionDays: 730,
  manualRescansPerDomainPerMonth: 10,
  domainGroupsEnabled: true,
  csvExportEnabled: true,
  privateAtomFeedEnabled: true,
  batchImportLimit: 10,
  monthlyCents: 1900,
  yearlyCents: 18900,
};

const AGENCY: PricingPlanEntry = {
  ...FREE,
  id: "agency",
  name: "Agency",
  savedDomainLimit: 100,
  monitoringFrequency: "weekly",
  historyRetentionDays: 1095,
  manualRescansPerDomainPerMonth: 20,
  domainGroupsEnabled: true,
  csvExportEnabled: true,
  privateAtomFeedEnabled: true,
  batchImportLimit: 100,
  agencyBrandingEnabled: true,
  monthlyCents: 3900,
  yearlyCents: 38900,
};

const PLANS = [FREE, SOLO, PRO, AGENCY];

function rowByKey(sectionId: string, key: string) {
  const section = COMPARISON_SECTIONS.find((s) => s.id === sectionId);
  if (!section) throw new Error(`Unknown section ${sectionId}`);
  const row = section.rows.find((r) => r.key === key);
  if (!row) throw new Error(`Unknown row ${key} in section ${sectionId}`);
  return row;
}

describe("formatHistoryRetention", () => {
  // Regression test for a real display bug found while building this comparison table: the
  // previous implementation pre-rounded `historyRetentionDays / 30` in pricing.astro, which
  // rendered Free's 30-day retention as "1 month" (Math.round(30/30) === 1, so the "else 30 days"
  // branch never fired) and Agency's 1095-day retention as "37 months" (1095/30 is exactly 36.5,
  // and Math.round breaks .5 ties up rather than down).
  it("shows Free's 30-day retention as days, not '1 month'", () => {
    expect(formatHistoryRetention(30)).toBe("30 days");
  });

  it("shows Agency's 1095-day retention as 36 months, not 37", () => {
    expect(formatHistoryRetention(1095)).toBe("36 months");
  });

  it("shows Solo's 365-day retention as 12 months", () => {
    expect(formatHistoryRetention(365)).toBe("12 months");
  });

  it("shows Pro's 730-day retention as 24 months", () => {
    expect(formatHistoryRetention(730)).toBe("24 months");
  });
});

describe("formatAutomaticMonitoring", () => {
  it("uses the commercially-meaningful comparison-table wording (§15)", () => {
    expect(formatAutomaticMonitoring("none")).toBe("No automatic monitoring");
    expect(formatAutomaticMonitoring("monthly")).toBe("Monthly");
    expect(formatAutomaticMonitoring("weekly")).toBe("Weekly");
  });
});

describe("comparison data truth — domains, history & monitoring", () => {
  it.each([
    ["saved-domains", FREE, "1"],
    ["saved-domains", SOLO, "5"],
    ["saved-domains", PRO, "25"],
    ["saved-domains", AGENCY, "100"],
    ["monitoring", FREE, "No automatic monitoring"],
    ["monitoring", SOLO, "Monthly"],
    ["monitoring", PRO, "Weekly"],
    ["monitoring", AGENCY, "Weekly"],
    ["rescans", FREE, "2"],
    ["rescans", SOLO, "5"],
    ["rescans", PRO, "10"],
    ["rescans", AGENCY, "20"],
    ["history", FREE, "30 days"],
    ["history", SOLO, "12 months"],
    ["history", PRO, "24 months"],
    ["history", AGENCY, "36 months"],
  ] as const)("%s for %s resolves to %s", (rowKey, plan, expected) => {
    const row = rowByKey("domains-history-monitoring", rowKey);
    const cell = row.cell(plan);
    expect(cell.kind === "value" ? cell.text : cell.kind).toBe(expected);
  });

  it.each([
    ["atom-feed", FREE, "not-included"],
    ["atom-feed", SOLO, "included"],
    ["atom-feed", PRO, "included"],
    ["atom-feed", AGENCY, "included"],
  ] as const)("%s for %s is %s", (rowKey, plan, expectedKind) => {
    const row = rowByKey("domains-history-monitoring", rowKey);
    expect(row.cell(plan).kind).toBe(expectedKind);
  });
});

describe("comparison data truth — portfolio workflows", () => {
  it.each([
    ["domain-groups", FREE, "not-included"],
    ["domain-groups", SOLO, "not-included"],
    ["domain-groups", PRO, "included"],
    ["domain-groups", AGENCY, "included"],
    ["csv-export", FREE, "not-included"],
    ["csv-export", SOLO, "not-included"],
    ["csv-export", PRO, "included"],
    ["csv-export", AGENCY, "included"],
  ] as const)("%s for %s is %s", (rowKey, plan, expectedKind) => {
    const row = rowByKey("portfolio-workflows", rowKey);
    expect(row.cell(plan).kind).toBe(expectedKind);
  });

  it.each([
    [FREE, "not-included"],
    [SOLO, "not-included"],
    [PRO, "value"],
    [AGENCY, "value"],
  ] as const)("batch-import for %s is %s", (plan, expectedKind) => {
    const row = rowByKey("portfolio-workflows", "batch-import");
    expect(row.cell(plan).kind).toBe(expectedKind);
  });

  it("shows Pro's batch import as 'Up to 10' and Agency's as 'Up to 100'", () => {
    const row = rowByKey("portfolio-workflows", "batch-import");
    expect(row.cell(PRO)).toEqual({ kind: "value", text: "Up to 10" });
    expect(row.cell(AGENCY)).toEqual({ kind: "value", text: "Up to 100" });
  });
});

describe("comparison data truth — Agency capabilities", () => {
  it.each([
    [FREE, "not-included"],
    [SOLO, "not-included"],
    [PRO, "not-included"],
    [AGENCY, "included"],
  ] as const)("agency-branding for %s is %s (only Agency)", (plan, expectedKind) => {
    const row = rowByKey("agency", "agency-branding");
    expect(row.cell(plan).kind).toBe(expectedKind);
  });
});

describe("universal core features (§34/§51)", () => {
  const coreSection = COMPARISON_SECTIONS.find((s) => s.id === "core-audit")!;

  it("marks every core-audit row as a universal product invariant", () => {
    for (const row of coreSection.rows) {
      expect(row.universal).toBe(true);
    }
  });

  it("resolves 'Included' for every plan on every core-audit row, with no plan-specific gating", () => {
    for (const row of coreSection.rows) {
      for (const plan of PLANS) {
        expect(row.cell(plan)).toEqual({ kind: "included" });
      }
    }
  });

  it("includes the required universal rows verbatim", () => {
    const labels = coreSection.rows.map((r) => r.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        "Complete AI crawler policy audit",
        "Print-friendly reports",
        "Private, revocable report sharing",
      ]),
    );
  });
});

describe("private report sharing stays a core capability (§20)", () => {
  it("is Included on every plan, and is not one of the Agency-only rows", () => {
    const coreSection = COMPARISON_SECTIONS.find((s) => s.id === "core-audit")!;
    const row = coreSection.rows.find((r) => r.label === "Private, revocable report sharing")!;
    for (const plan of PLANS) {
      expect(row.cell(plan)).toEqual({ kind: "included" });
    }
    const agencySection = COMPARISON_SECTIONS.find((s) => s.id === "agency")!;
    expect(agencySection.rows.some((r) => r.label.includes("report sharing"))).toBe(false);
  });
});

describe("forbidden pricing claims (§6/§52)", () => {
  it("never advertises a forbidden term in any row label or description", () => {
    const allText = COMPARISON_SECTIONS.flatMap((section) => [
      section.heading,
      section.caption,
      ...section.rows.flatMap((r) => [r.label, r.description ?? ""]),
    ])
      .join(" ")
      .toLowerCase();

    for (const term of FORBIDDEN_PRICING_TERMS) {
      expect(allText).not.toContain(term);
    }
  });
});

describe("planPriceLabel (§25)", () => {
  it("derives the header price label from the same plan prop — never a second price source", () => {
    expect(planPriceLabel(FREE, "year")).toBe("$0");
    expect(planPriceLabel(SOLO, "month")).toBe("$9/month");
    expect(planPriceLabel(SOLO, "year")).toBe("$89/year");
    expect(planPriceLabel(PRO, "month")).toBe("$19/month");
    expect(planPriceLabel(AGENCY, "year")).toBe("$389/year");
  });
});
