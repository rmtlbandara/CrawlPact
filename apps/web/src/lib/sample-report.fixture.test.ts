import { describe, expect, it } from "vitest";
import { auditReportResponseSchema } from "@crawlpact/core";
import { SAMPLE_REPORT } from "./sample-report.fixture";

describe("SAMPLE_REPORT fixture (Phase 4 sample-report page)", () => {
  it("is a valid instance of the real AuditReportResponse contract", () => {
    expect(() => auditReportResponseSchema.parse(SAMPLE_REPORT)).not.toThrow();
  });

  it("uses a fictional .example domain, never a real or customer domain", () => {
    expect(SAMPLE_REPORT.domain).toMatch(/\.example$/);
  });

  it("has an auditId that cannot resolve as a real audit", () => {
    expect(SAMPLE_REPORT.auditId).toBe("sample-fixture-not-a-real-audit");
  });

  it("discloses that it is a sample in its own limitations", () => {
    expect(SAMPLE_REPORT.limitations.some((l) => /sample/i.test(l))).toBe(true);
  });

  it("contains no obvious personal or account identifiers", () => {
    const serialised = JSON.stringify(SAMPLE_REPORT);
    expect(serialised).not.toMatch(/@(?!example)[\w.-]+\.[a-z]{2,}/i);
  });

  it("has at least one finding to demonstrate real report structure", () => {
    expect(SAMPLE_REPORT.findings.length).toBeGreaterThan(0);
  });
});
