import { describe, expect, it } from "vitest";
import { buildFindings } from "./findings";
import type { Conflict } from "./conflicts";

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
