import { describe, expect, it } from "vitest";
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

describe("detectConflicts", () => {
  it("flags a blocked search crawler under maximum_ai_visibility", () => {
    const conflicts = detectConflicts(
      input({
        preset: "maximum_ai_visibility",
        crawlerEvaluations: [
          crawler({ purpose: "search", result: "blocked", matchedRule: "/", matchedLineNumber: 2 }),
        ],
      }),
    );
    expect(conflicts).toContainEqual(
      expect.objectContaining({ code: "SEARCH_VISIBILITY_CONFLICT" }),
    );
  });

  it("flags an allowed training crawler under allow_search_block_training", () => {
    const conflicts = detectConflicts(
      input({
        preset: "allow_search_block_training",
        crawlerEvaluations: [crawler({ purpose: "training", result: "allowed" })],
      }),
    );
    expect(conflicts).toContainEqual(
      expect.objectContaining({ code: "TRAINING_RESTRICTION_CONFLICT" }),
    );
  });

  it("does not flag an aligned crawler", () => {
    const conflicts = detectConflicts(
      input({
        preset: "maximum_ai_visibility",
        crawlerEvaluations: [crawler({ purpose: "search", result: "allowed" })],
      }),
    );
    expect(conflicts).toEqual([]);
  });

  it("flags a deprecated token in use", () => {
    const conflicts = detectConflicts(
      input({
        crawlerEvaluations: [crawler({ lifecycleStatus: "deprecated", result: "blocked" })],
      }),
    );
    expect(conflicts).toContainEqual(expect.objectContaining({ code: "DEPRECATED_TOKEN_IN_USE" }));
  });

  it("flags a missing replacement for a replaced token", () => {
    const conflicts = detectConflicts(
      input({
        crawlerEvaluations: [
          crawler({
            crawlerId: "old",
            lifecycleStatus: "replaced",
            replacementCrawlerId: "new",
            result: "blocked",
          }),
        ],
      }),
    );
    expect(conflicts).toContainEqual(
      expect.objectContaining({ code: "REPLACEMENT_TOKEN_MISSING" }),
    );
  });

  it("does not flag a missing replacement when the replacement already has a rule", () => {
    const conflicts = detectConflicts(
      input({
        crawlerEvaluations: [
          crawler({
            crawlerId: "old",
            lifecycleStatus: "replaced",
            replacementCrawlerId: "new",
            result: "blocked",
          }),
          crawler({ crawlerId: "new", result: "blocked" }),
        ],
      }),
    );
    expect(conflicts.some((c) => c.code === "REPLACEMENT_TOKEN_MISSING")).toBe(false);
  });

  it("flags unknown-purpose crawlers with a decision as needing review", () => {
    const conflicts = detectConflicts(
      input({ crawlerEvaluations: [crawler({ purpose: "unknown", result: "blocked" })] }),
    );
    expect(conflicts).toContainEqual(
      expect.objectContaining({ code: "UNKNOWN_PURPOSE_REQUIRES_REVIEW" }),
    );
  });

  it("flags a broad wildcard block", () => {
    const conflicts = detectConflicts(
      input({
        signals: {
          ...emptySignals(),
          robots: { ...emptySignals().robots, hasBroadWildcardBlock: true },
        },
      }),
    );
    expect(conflicts).toContainEqual(expect.objectContaining({ code: "BROAD_WILDCARD_OVERRIDE" }));
  });

  it("flags duplicate groups", () => {
    const conflicts = detectConflicts(
      input({
        signals: {
          ...emptySignals(),
          robots: { ...emptySignals().robots, hasDuplicateGroups: true },
        },
      }),
    );
    expect(conflicts).toContainEqual(
      expect.objectContaining({ code: "DUPLICATE_GROUP_UNEXPECTED_MATCH" }),
    );
  });

  it("flags RSL vs Content Signals disagreement on training", () => {
    const conflicts = detectConflicts(
      input({
        signals: {
          ...emptySignals(),
          rsl: {
            discovered: true,
            permits: [],
            prohibits: ["training"],
            paymentTerms: [],
            unsupportedElements: [],
            issues: [],
            truncated: false,
          },
          contentSignals: { recognised: { "ai-train": "yes" }, unknownFields: {}, raw: "" },
        },
      }),
    );
    expect(conflicts).toContainEqual(
      expect.objectContaining({ code: "RSL_CONTENT_SIGNALS_DISAGREEMENT" }),
    );
  });

  it("is deterministic: identical input produces identical output", () => {
    const testInput = input({
      preset: "block_known_ai_crawlers",
      crawlerEvaluations: [crawler({ purpose: "training", result: "allowed" })],
    });
    expect(detectConflicts(testInput)).toEqual(detectConflicts(testInput));
  });
});
