import { describe, expect, it } from "vitest";
import { generateRecommendations } from "./recommendations";
import { buildRobotsDiff, fullProposedText, addedLinesOnly } from "./diff";
import { evaluateRobots, parseRobotsTxt } from "@crawlpact/robots";
import type { Conflict } from "./conflicts";
import type { CrawlerEvaluation } from "./types";

const gptbot: CrawlerEvaluation = {
  crawlerId: "crw_gptbot",
  crawlerName: "GPTBot",
  operatorName: "OpenAI",
  userAgentToken: "GPTBot",
  purpose: "training",
  lifecycleStatus: "active",
  replacementCrawlerId: null,
  result: "allowed",
  matchedRule: null,
  matchedLineNumber: null,
};

const trainingConflict: Conflict = {
  code: "TRAINING_RESTRICTION_CONFLICT",
  signalsInvolved: ["robots.txt"],
  evidence: "GPTBot has no blocking rule.",
  likelyBusinessEffect: "Training crawler is allowed.",
  recommendedAction: "Add a Disallow rule.",
  confidence: "high",
  affectedCrawlerId: "crw_gptbot",
};

const searchbot: CrawlerEvaluation = {
  crawlerId: "crw_search",
  crawlerName: "OAI-SearchBot",
  operatorName: "OpenAI",
  userAgentToken: "OAI-SearchBot",
  purpose: "search",
  lifecycleStatus: "active",
  replacementCrawlerId: null,
  result: "blocked",
  matchedRule: "/",
  matchedLineNumber: 2,
};

const searchConflict: Conflict = {
  code: "SEARCH_VISIBILITY_CONFLICT",
  signalsInvolved: ["robots.txt"],
  evidence: "OAI-SearchBot is blocked.",
  likelyBusinessEffect: "Search visibility may drop.",
  recommendedAction: "Allow OAI-SearchBot.",
  confidence: "high",
  affectedCrawlerId: "crw_search",
};

describe("generateRecommendations", () => {
  it("appends a Disallow group for a training crawler that should be restricted", () => {
    const result = generateRecommendations([trainingConflict], [gptbot]);
    expect(result.proposedAdditions).toEqual(["User-agent: GPTBot", "Disallow: /"]);
    expect(result.warnings.length).toBe(1);
  });

  it("appends an Allow group for a search crawler that should be exempted", () => {
    const result = generateRecommendations([searchConflict], [searchbot]);
    expect(result.proposedAdditions).toEqual(["User-agent: OAI-SearchBot", "Allow: /"]);
  });

  it("produces no additions when there are no relevant conflicts", () => {
    const result = generateRecommendations([], [gptbot]);
    expect(result.proposedAdditions).toEqual([]);
  });

  it("the appended Allow group actually overrides a wildcard block when re-evaluated", () => {
    const original = "User-agent: *\nDisallow: /\n";
    const { proposedAdditions } = generateRecommendations([searchConflict], [searchbot]);
    const proposedText = fullProposedText(original, proposedAdditions);
    const parsed = parseRobotsTxt(proposedText);
    const result = evaluateRobots(parsed, "OAI-SearchBot", "/anything");
    expect(result.result).toBe("allowed");
  });

  it("the appended Disallow group actually restricts a previously-unrestricted crawler when re-evaluated", () => {
    const original = "User-agent: *\nAllow: /\n";
    const { proposedAdditions } = generateRecommendations([trainingConflict], [gptbot]);
    const proposedText = fullProposedText(original, proposedAdditions);
    const parsed = parseRobotsTxt(proposedText);
    const result = evaluateRobots(parsed, "GPTBot", "/anything");
    expect(result.result).toBe("blocked");
  });
});

describe("diff helpers", () => {
  it("builds a diff with original lines unchanged and new lines added", () => {
    const diff = buildRobotsDiff("User-agent: *\nAllow: /\n", [
      "User-agent: GPTBot",
      "Disallow: /",
    ]);
    expect(diff.filter((l) => l.type === "unchanged")).toHaveLength(3); // 2 content lines + trailing empty line from split
    expect(diff.filter((l) => l.type === "added")).toHaveLength(2);
  });

  it("addedLinesOnly returns just the new lines, newline-joined", () => {
    expect(addedLinesOnly(["a", "b"])).toBe("a\nb");
  });

  it("fullProposedText returns the original unchanged when there are no additions", () => {
    expect(fullProposedText("original", [])).toBe("original");
  });
});
