import { describe, expect, it } from "vitest";
import {
  buildRegistryLandscapeContent,
  validateResearchPublicationContent,
  type ResearchPublicationContent,
} from "./publication-content";
import type { RegistryObservatorySnapshot } from "../observatory/registry-observatory";

function makeSnapshot(
  overrides: Partial<RegistryObservatorySnapshot> = {},
): RegistryObservatorySnapshot {
  return {
    generatedAt: "2026-08-11T00:00:00.000Z",
    registryVersionId: "reg_test",
    versionLabel: "test-1",
    publishedAt: "2026-08-01T00:00:00.000Z",
    checksum: "abc123",
    wasActiveAtGeneration: true,
    crawlerCount: 10,
    operatorCount: 3,
    evaluationEligibleCount: 9,
    purposeDistribution: { search: 6, training: 4 },
    lifecycleDistribution: { active: 9, retired: 1 },
    operatorByPurpose: [{ operatorId: "op_1", operatorName: "Op One", purposes: ["search"] }],
    verification: {
      verifiedCount: 10,
      neverVerifiedCount: 0,
      oldestVerifiedAt: "2026-01-01T00:00:00.000Z",
      newestVerifiedAt: "2026-08-01T00:00:00.000Z",
      medianAgeDays: 90,
      reviewDueCount: 1,
    },
    releaseHistory: [],
    totalReleases: 1,
    ...overrides,
  };
}

describe("buildRegistryLandscapeContent", () => {
  it("produces a finding with numerator/denominator/scope for every purpose", () => {
    const content = buildRegistryLandscapeContent(makeSnapshot());
    const purposeFindings = content.keyFindings.filter((f) =>
      f.label.includes("classified with purpose"),
    );
    expect(purposeFindings).toHaveLength(2);
    for (const finding of purposeFindings) {
      expect(finding.denominator).toBe(10);
      expect(finding.scope).toContain("test-1");
    }
  });

  it("never claims a trend from a single release", () => {
    const content = buildRegistryLandscapeContent(
      makeSnapshot({ totalReleases: 1, releaseHistory: [] }),
    );
    const results = content.sections.find((s) => s.heading === "Results");
    expect(results?.body).toMatch(/no change-over-time claim is made/);
  });

  it("is deterministic — the same snapshot always produces identical content", () => {
    const snapshot = makeSnapshot();
    const a = buildRegistryLandscapeContent(snapshot);
    const b = buildRegistryLandscapeContent(snapshot);
    expect(a).toEqual(b);
  });
});

describe("validateResearchPublicationContent", () => {
  function validContent(): ResearchPublicationContent {
    return buildRegistryLandscapeContent(makeSnapshot());
  }

  it("passes a well-formed publication", () => {
    const result = validateResearchPublicationContent(validContent());
    expect(result.errors).toEqual([]);
  });

  it("rejects a finding whose numerator exceeds its denominator", () => {
    const content = validContent();
    content.keyFindings[0]!.numerator = 999;
    const result = validateResearchPublicationContent(content);
    expect(result.errors.some((e) => e.code === "NUMERATOR_EXCEEDS_DENOMINATOR")).toBe(true);
  });

  it("rejects a publication with no limitations", () => {
    const content = validContent();
    content.limitations = [];
    const result = validateResearchPublicationContent(content);
    expect(result.errors.some((e) => e.code === "NO_LIMITATIONS")).toBe(true);
  });

  it("rejects unsupported-claim language", () => {
    const content = validContent();
    content.summary = "This is the definitive AI crawler database.";
    const result = validateResearchPublicationContent(content);
    expect(result.errors.some((e) => e.code === "UNSUPPORTED_CLAIM_LANGUAGE")).toBe(true);
  });

  it("warns, but does not error, on a zero-denominator finding", () => {
    const content = validContent();
    content.keyFindings.push({
      label: "No eligible records",
      numerator: 0,
      denominator: 0,
      scope: "test",
    });
    const result = validateResearchPublicationContent(content);
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => w.code === "ZERO_DENOMINATOR")).toBe(true);
  });
});
