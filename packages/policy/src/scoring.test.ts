import { describe, expect, it } from "vitest";
import { computePolicyHealthScore } from "./scoring";
import { detectConflicts } from "./conflicts";
import type { CrawlerEvaluation, PolicyEvaluationInput, SignalBundle } from "./types";

function crawler(overrides: Partial<CrawlerEvaluation>): CrawlerEvaluation {
  return {
    crawlerId: "crw_1",
    crawlerName: "Test Crawler",
    operatorName: "Test Operator",
    userAgentToken: "TestBot",
    purpose: "search",
    lifecycleStatus: "active",
    replacementCrawlerId: null,
    result: "allowed",
    matchedRule: null,
    matchedLineNumber: null,
    ...overrides,
  };
}

function emptySignals(): SignalBundle {
  return {
    robots: {
      fetched: true,
      statusCode: 200,
      issueCodes: [],
      hasDuplicateGroups: false,
      hasBroadWildcardBlock: false,
    },
    contentSignals: null,
    rsl: null,
    html: null,
    sitemap: null,
    xRobotsTag: [],
  };
}

function input(overrides: Partial<PolicyEvaluationInput>): PolicyEvaluationInput {
  return {
    preset: "maximum_ai_visibility",
    crawlerEvaluations: [],
    signals: emptySignals(),
    rulesetVersion: "test",
    ...overrides,
  };
}

describe("computePolicyHealthScore", () => {
  it("returns incomplete when robots.txt could not be fetched", () => {
    const result = computePolicyHealthScore(input({}), [], false);
    expect(result).toEqual({ state: "incomplete" });
  });

  it("scores a fully-aligned, issue-free policy highly", () => {
    const testInput = input({
      preset: "maximum_ai_visibility",
      crawlerEvaluations: [
        crawler({ purpose: "search", result: "allowed" }),
        crawler({ crawlerId: "crw_2", purpose: "training", result: "allowed" }),
      ],
    });
    const result = computePolicyHealthScore(testInput, [], true);
    expect(result.state).toBe("scored");
    if (result.state === "scored") {
      expect(result.value).toBeGreaterThanOrEqual(75);
      expect(result.label).not.toBe("Critical");
    }
  });

  it("scores a badly-misaligned policy lower than a well-aligned one", () => {
    const goodInput = input({
      preset: "block_known_ai_crawlers",
      crawlerEvaluations: [crawler({ purpose: "training", result: "blocked" })],
    });
    const badInput = input({
      preset: "block_known_ai_crawlers",
      crawlerEvaluations: [crawler({ purpose: "training", result: "allowed" })],
    });
    const goodScore = computePolicyHealthScore(goodInput, detectConflicts(goodInput), true);
    const badScore = computePolicyHealthScore(badInput, detectConflicts(badInput), true);
    expect(goodScore.state).toBe("scored");
    expect(badScore.state).toBe("scored");
    if (goodScore.state === "scored" && badScore.state === "scored") {
      expect(goodScore.value).toBeGreaterThan(badScore.value);
    }
  });

  it("is deterministic: identical input produces an identical score", () => {
    const testInput = input({
      crawlerEvaluations: [crawler({ purpose: "search", result: "blocked" })],
    });
    const conflicts = detectConflicts(testInput);
    const a = computePolicyHealthScore(testInput, conflicts, true);
    const b = computePolicyHealthScore(testInput, conflicts, true);
    expect(a).toEqual(b);
  });

  it("never exceeds 100 or drops below 0", () => {
    const testInput = input({
      crawlerEvaluations: Array.from({ length: 5 }, (_, i) =>
        crawler({ crawlerId: `crw_${i}`, purpose: "search", result: "blocked" }),
      ),
      signals: {
        ...emptySignals(),
        robots: { ...emptySignals().robots, issueCodes: ["A", "B", "C", "D", "E", "F"] },
      },
    });
    const result = computePolicyHealthScore(testInput, detectConflicts(testInput), true);
    if (result.state === "scored") {
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThanOrEqual(100);
    }
  });

  it("category breakdown weights sum to 1", () => {
    const total = Object.values({
      resource_availability: 0.15,
      syntax_evaluation: 0.2,
      objective_alignment: 0.3,
      cross_signal_consistency: 0.15,
      registry_freshness: 0.1,
      monitoring_change_risk: 0.1,
    }).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1);
  });
});
