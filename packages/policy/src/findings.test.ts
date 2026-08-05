import { describe, expect, it } from "vitest";
import { buildFindings, selectFindingsForPersistence, MAX_PERSISTED_FINDINGS } from "./findings";
import type { Conflict } from "./conflicts";
import type { Finding, FindingSeverity } from "./findings";

const sampleConflict: Conflict = {
  code: "SEARCH_VISIBILITY_CONFLICT",
  signalsInvolved: ["robots.txt"],
  evidence: "Line 2 blocks OAI-SearchBot.",
  likelyBusinessEffect: "Search visibility may be reduced.",
  recommendedAction: "Allow OAI-SearchBot.",
  confidence: "high",
  affectedCrawlerId: "crw_oai_searchbot",
};

describe("buildFindings", () => {
  it("maps a conflict to a fully-structured finding", () => {
    const [finding] = buildFindings([sampleConflict], "rules_2026_07_2");
    expect(finding).toMatchObject({
      code: "SEARCH_VISIBILITY_CONFLICT",
      severity: "critical",
      category: "objective-alignment",
      rulesetVersion: "rules_2026_07_2",
      affectedCrawlerId: "crw_oai_searchbot",
    });
    expect(finding!.fingerprint).toMatch(/^[0-9a-f]{8}$/);
  });

  it("does not attach a limitation note to high-confidence findings", () => {
    const [finding] = buildFindings([sampleConflict], "v1");
    expect(finding!.limitation).toBeNull();
  });

  it("attaches a limitation note to non-high-confidence findings", () => {
    const [finding] = buildFindings([{ ...sampleConflict, confidence: "low" }], "v1");
    expect(finding!.limitation).not.toBeNull();
  });

  it("produces the same fingerprint for the same conflict every time", () => {
    const [a] = buildFindings([sampleConflict], "v1");
    const [b] = buildFindings([sampleConflict], "v1");
    expect(a!.fingerprint).toBe(b!.fingerprint);
  });

  it("produces different fingerprints for different evidence", () => {
    const [a] = buildFindings([sampleConflict], "v1");
    const [b] = buildFindings([{ ...sampleConflict, evidence: "different evidence" }], "v1");
    expect(a!.fingerprint).not.toBe(b!.fingerprint);
  });
});

function makeFinding(overrides: Partial<Finding> & { code: string }): Finding {
  return {
    severity: overrides.severity ?? "medium",
    category: "robots-syntax",
    title: "t",
    summary: "s",
    whatHappened: "s",
    whyItMatters: "w",
    evidenceSummary: "e",
    recommendedAction: "r",
    limitation: null,
    confidence: "high",
    sourceUrl: null,
    rulesetVersion: "v1",
    affectedCrawlerId: overrides.affectedCrawlerId ?? null,
    fingerprint: overrides.fingerprint ?? Math.random().toString(16),
    ...overrides,
  };
}

describe("selectFindingsForPersistence", () => {
  it("keeps everything and reports zero omitted when at or under the cap", () => {
    const findings = [makeFinding({ code: "A" }), makeFinding({ code: "B" })];
    const result = selectFindingsForPersistence(findings, 5);
    expect(result.kept).toEqual(findings);
    expect(result.omittedCount).toBe(0);
  });

  it("handles zero findings", () => {
    const result = selectFindingsForPersistence([], 5);
    expect(result.kept).toEqual([]);
    expect(result.omittedCount).toBe(0);
  });

  it("caps at the default MAX_PERSISTED_FINDINGS and discloses the omitted count", () => {
    const findings = Array.from({ length: MAX_PERSISTED_FINDINGS + 10 }, (_, i) =>
      makeFinding({ code: `CODE_${i}`, severity: "low" }),
    );
    const result = selectFindingsForPersistence(findings);
    expect(result.kept.length).toBe(MAX_PERSISTED_FINDINGS);
    expect(result.omittedCount).toBe(10);
  });

  it("preserves highest severity first", () => {
    const findings = [
      makeFinding({ code: "A", severity: "low" }),
      makeFinding({ code: "B", severity: "critical" }),
      makeFinding({ code: "C", severity: "medium" }),
    ];
    const result = selectFindingsForPersistence(findings, 2);
    expect(result.kept.map((f) => f.severity)).toEqual(["critical", "medium"]);
    expect(result.omittedCount).toBe(1);
  });

  it("preserves diversity across finding codes — many duplicate-code findings do not crowd out a rarer code", () => {
    // 21 instances of one code (one per crawler, the realistic worst case),
    // plus a single instance of a different, lower-severity code.
    const dominant = Array.from({ length: 21 }, (_, i) =>
      makeFinding({
        code: "DEPRECATED_TOKEN_IN_USE",
        severity: "medium",
        affectedCrawlerId: `crw_${i}`,
      }),
    );
    const rare = makeFinding({ code: "UNKNOWN_PURPOSE_REQUIRES_REVIEW", severity: "information" });
    const result = selectFindingsForPersistence([...dominant, rare], 5);
    expect(result.kept.length).toBe(5);
    // The rare code must appear even though it's lower severity than every
    // instance of the dominant code — diversity beats pure severity ranking
    // once every code has had its highest-severity instance included.
    expect(result.kept.some((f) => f.code === "UNKNOWN_PURPOSE_REQUIRES_REVIEW")).toBe(true);
    expect(result.omittedCount).toBe(17);
  });

  it("is deterministic — the same input always produces the same output", () => {
    const findings = Array.from({ length: 40 }, (_, i) =>
      makeFinding({
        code: `CODE_${i % 4}`,
        severity: (["critical", "high", "medium", "low"] as FindingSeverity[])[i % 4],
      }),
    );
    const a = selectFindingsForPersistence(findings, 10);
    const b = selectFindingsForPersistence(findings, 10);
    expect(a.kept.map((f) => f.fingerprint)).toEqual(b.kept.map((f) => f.fingerprint));
  });

  it("respects a custom cap", () => {
    const findings = Array.from({ length: 8 }, (_, i) => makeFinding({ code: `C${i}` }));
    const result = selectFindingsForPersistence(findings, 3);
    expect(result.kept.length).toBe(3);
    expect(result.omittedCount).toBe(5);
  });
});
