import { describe, expect, it } from "vitest";
import type { AuditReportResponse, CrawlerMatrixRow, Finding } from "@crawlpact/core";
import { computePolicySummary, deriveConversionCtaCopy } from "./policy-summary";

function row(
  purpose: CrawlerMatrixRow["purpose"],
  result: CrawlerMatrixRow["result"],
): CrawlerMatrixRow {
  return {
    crawlerId: `${purpose}-${result}-bot`,
    crawlerName: "Test Bot",
    operator: "Test Operator",
    purpose,
    result,
    matchedRule: null,
    matchedLineNumber: null,
    source: "robots.txt",
    lastVerified: null,
  };
}

function finding(code: string): Finding {
  return {
    code,
    severity: "medium",
    category: "test",
    title: "Test finding",
    summary: "Test summary",
    whatHappened: "Test",
    whyItMatters: "Test",
    evidenceSummary: "Test",
    recommendedAction: "Test",
    limitation: null,
    confidence: "high",
    sourceUrl: null,
    rulesetVersion: "test",
  };
}

function baseReport(overrides: Partial<AuditReportResponse> = {}): AuditReportResponse {
  return {
    auditId: "test-audit",
    domain: "example.com",
    scanDate: "2026-08-04T00:00:00.000Z",
    status: "completed",
    preset: "test",
    score: { state: "scored", value: 80, label: "Good", categoryBreakdown: [] },
    crawlerMatrix: [],
    findings: [],
    registryVersion: "2026.08.1",
    rulesetVersion: "2026.08.1",
    limitations: [],
    llmsTxt: {
      checked: true,
      found: false,
      hasH1Heading: false,
      linkedResources: [],
      sizeBytes: 0,
      issues: [],
    },
    llmsFullTxt: {
      checked: true,
      found: false,
      hasH1Heading: false,
      linkedResources: [],
      sizeBytes: 0,
      issues: [],
    },
    rsl: {
      checked: true,
      discovered: false,
      permits: [],
      prohibits: [],
      paymentTerms: [],
      unsupportedElements: [],
      issues: [],
    },
    contentSignals: { checked: true, present: false, recognised: {}, unknownFields: {}, raw: null },
    robotsMeta: {
      checked: true,
      metaRobots: null,
      canonicalUrl: null,
      policyReferenceLinks: [],
      xRobotsTag: [],
    },
    ...overrides,
  };
}

describe("computePolicySummary", () => {
  it("classifies a clean baseline: all purposes allowed, no findings", () => {
    const report = baseReport({
      crawlerMatrix: [
        row("search", "allowed"),
        row("training", "allowed"),
        row("user_triggered", "allowed"),
        row("agent", "allowed"),
      ],
    });
    const summary = computePolicySummary(report);
    expect(summary).toEqual({
      aiSearchDiscoverability: "No explicit issue detected",
      trainingPolicyDeclaration: "Explicitly allowed",
      userTriggeredRetrieval: "Explicitly allowed",
      agentAccess: "Explicitly allowed",
      crossSignalConsistency: "No conflict detected",
      monitoring: "Not enabled",
    });
  });

  it("classifies a conflict report: mixed search results plus a search conflict finding", () => {
    const report = baseReport({
      crawlerMatrix: [row("search", "allowed"), row("search", "blocked")],
      findings: [finding("SEARCH_VISIBILITY_CONFLICT")],
    });
    const summary = computePolicySummary(report);
    expect(summary.aiSearchDiscoverability).toBe("Attention recommended");
    expect(summary.crossSignalConsistency).toBe("Conflict detected");
  });

  it("upgrades search discoverability to attention-recommended on a search conflict finding even when all rows are allowed", () => {
    const report = baseReport({
      crawlerMatrix: [row("search", "allowed")],
      findings: [finding("SEARCH_VISIBILITY_CONFLICT")],
    });
    expect(computePolicySummary(report).aiSearchDiscoverability).toBe("Attention recommended");
  });

  it("never upgrades an already-worse classification back toward no-issue-detected", () => {
    const report = baseReport({
      crawlerMatrix: [row("search", "blocked")],
      findings: [finding("SEARCH_VISIBILITY_CONFLICT")],
    });
    expect(computePolicySummary(report).aiSearchDiscoverability).toBe("At risk");
  });

  it("classifies training-policy-unspecified: all training rows no_explicit_rule", () => {
    const report = baseReport({
      crawlerMatrix: [row("training", "no_explicit_rule"), row("training", "no_explicit_rule")],
    });
    expect(computePolicySummary(report).trainingPolicyDeclaration).toBe("Unspecified");
  });

  it("never describes unspecified as explicit permission", () => {
    const report = baseReport({ crawlerMatrix: [row("agent", "no_explicit_rule")] });
    const label = computePolicySummary(report).agentAccess;
    expect(label).not.toBe("Explicitly allowed");
    expect(label).toBe("Unspecified");
  });

  it("classifies a partial/incomplete scan: resource_unavailable rows and an unreachable-directive finding", () => {
    const report = baseReport({
      crawlerMatrix: [row("training", "resource_unavailable")],
      findings: [finding("PAGE_DIRECTIVE_UNREACHABLE")],
    });
    const summary = computePolicySummary(report);
    expect(summary.trainingPolicyDeclaration).toBe("Unable to determine");
    expect(summary.crossSignalConsistency).toBe("Incomplete evidence");
  });

  it("never describes an unavailable resource as a deliberate block", () => {
    const report = baseReport({ crawlerMatrix: [row("user_triggered", "resource_unavailable")] });
    const label = computePolicySummary(report).userTriggeredRetrieval;
    expect(label).not.toBe("Explicitly restricted");
    expect(label).toBe("Unable to determine");
  });

  it("classifies registry uncertainty: unknown results dominate a purpose", () => {
    const report = baseReport({
      crawlerMatrix: [row("agent", "unknown"), row("agent", "unknown")],
    });
    expect(computePolicySummary(report).agentAccess).toBe("Unable to determine");
  });

  it("returns unable-to-determine for a purpose with no crawler rows at all", () => {
    const report = baseReport({ crawlerMatrix: [row("search", "allowed")] });
    expect(computePolicySummary(report).agentAccess).toBe("Unable to determine");
  });

  it("classifies mixed training results as Mixed, not allowed or restricted", () => {
    const report = baseReport({
      crawlerMatrix: [row("training", "allowed"), row("training", "blocked")],
    });
    expect(computePolicySummary(report).trainingPolicyDeclaration).toBe("Mixed");
  });

  it("reports cross-signal consistency as no-conflict-detected when findings are unrelated to conflicts", () => {
    const report = baseReport({
      crawlerMatrix: [row("search", "allowed")],
      findings: [finding("DEPRECATED_TOKEN_IN_USE")],
    });
    expect(computePolicySummary(report).crossSignalConsistency).toBe("No conflict detected");
  });

  it("always reports monitoring as not enabled, regardless of report content", () => {
    const report = baseReport({ crawlerMatrix: [row("search", "blocked")] });
    expect(computePolicySummary(report).monitoring).toBe("Not enabled");
  });

  it("never changes or reads report.score beyond its state field", () => {
    const report = baseReport({ score: { state: "incomplete" }, crawlerMatrix: [] });
    const summary = computePolicySummary(report);
    expect(summary.crossSignalConsistency).toBe("Unable to determine");
    // score object itself must remain untouched
    expect(report.score).toEqual({ state: "incomplete" });
  });
});

describe("deriveConversionCtaCopy", () => {
  it("picks conflict_detected above every other condition, even a missing registry version", () => {
    const report = baseReport({
      registryVersion: null,
      crawlerMatrix: [row("search", "blocked")],
      findings: [finding("SEARCH_VISIBILITY_CONFLICT")],
    });
    const summary = computePolicySummary(report);
    expect(summary.crossSignalConsistency).toBe("Conflict detected");
    expect(deriveConversionCtaCopy(report, summary).variant).toBe("conflict_detected");
  });

  it("picks registry_uncertainty when the registry version is missing and there is no conflict", () => {
    const report = baseReport({
      registryVersion: null,
      crawlerMatrix: [row("search", "allowed")],
    });
    const summary = computePolicySummary(report);
    expect(deriveConversionCtaCopy(report, summary).variant).toBe("registry_uncertainty");
  });

  it("picks registry_uncertainty when the ruleset version is missing and there is no conflict", () => {
    const report = baseReport({
      rulesetVersion: null,
      crawlerMatrix: [row("search", "allowed")],
    });
    const summary = computePolicySummary(report);
    expect(deriveConversionCtaCopy(report, summary).variant).toBe("registry_uncertainty");
  });

  it("picks search_risk when search access is restricted and the registry is known", () => {
    const report = baseReport({ crawlerMatrix: [row("search", "blocked")] });
    const summary = computePolicySummary(report);
    expect(deriveConversionCtaCopy(report, summary).variant).toBe("search_risk");
  });

  it("picks incomplete_evidence when cross-signal consistency can't be established", () => {
    const report = baseReport({
      crawlerMatrix: [row("search", "allowed"), row("training", "resource_unavailable")],
      findings: [finding("PAGE_DIRECTIVE_UNREACHABLE")],
    });
    const summary = computePolicySummary(report);
    expect(summary.crossSignalConsistency).toBe("Incomplete evidence");
    expect(deriveConversionCtaCopy(report, summary).variant).toBe("incomplete_evidence");
  });

  it("picks training_unspecified when only the training declaration is missing", () => {
    const report = baseReport({
      crawlerMatrix: [row("search", "allowed"), row("training", "no_explicit_rule")],
    });
    const summary = computePolicySummary(report);
    expect(summary.trainingPolicyDeclaration).toBe("Unspecified");
    expect(deriveConversionCtaCopy(report, summary).variant).toBe("training_unspecified");
  });

  it("picks clean_baseline when nothing else matches", () => {
    const report = baseReport({
      crawlerMatrix: [row("search", "allowed"), row("training", "allowed")],
    });
    const summary = computePolicySummary(report);
    expect(deriveConversionCtaCopy(report, summary).variant).toBe("clean_baseline");
  });

  it("always returns non-empty headline and body text for every variant", () => {
    const reports = [
      baseReport({
        crawlerMatrix: [row("search", "blocked")],
        findings: [finding("SEARCH_VISIBILITY_CONFLICT")],
      }),
      baseReport({ registryVersion: null, crawlerMatrix: [row("search", "allowed")] }),
      baseReport({ crawlerMatrix: [row("search", "blocked")] }),
      baseReport({ crawlerMatrix: [], findings: [] }),
      baseReport({ crawlerMatrix: [row("training", "no_explicit_rule")] }),
      baseReport({ crawlerMatrix: [row("search", "allowed"), row("training", "allowed")] }),
    ];
    for (const report of reports) {
      const copy = deriveConversionCtaCopy(report, computePolicySummary(report));
      expect(copy.headline.length).toBeGreaterThan(0);
      expect(copy.body.length).toBeGreaterThan(0);
    }
  });
});
