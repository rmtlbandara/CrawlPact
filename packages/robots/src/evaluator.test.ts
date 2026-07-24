import { describe, expect, it } from "vitest";
import { parseRobotsTxt } from "./parser";
import { evaluateRobots } from "./evaluator";

function evaluate(text: string, token: string, path: string) {
  return evaluateRobots(parseRobotsTxt(text), token, path);
}

describe("evaluateRobots", () => {
  it("returns no_explicit_rule when no group applies", () => {
    const result = evaluate("User-agent: GPTBot\nDisallow: /\n", "ClaudeBot", "/anything");
    expect(result.result).toBe("no_explicit_rule");
  });

  it("falls back to the wildcard group when no exact match exists", () => {
    const result = evaluate("User-agent: *\nDisallow: /admin\n", "GPTBot", "/admin/x");
    expect(result.result).toBe("blocked");
    expect(result.lineNumber).toBe(2);
  });

  it("prefers an exact-match group over the wildcard group", () => {
    const result = evaluate(
      "User-agent: *\nDisallow: /\nUser-agent: GPTBot\nAllow: /\n",
      "GPTBot",
      "/anything",
    );
    expect(result.result).toBe("allowed");
  });

  it("allows a path with no matching rule (default allow)", () => {
    const result = evaluate("User-agent: *\nDisallow: /admin\n", "*", "/public");
    expect(result.result).toBe("allowed");
    expect(result.matchedRule).toBeNull();
  });

  it("picks the longest (most specific) matching rule", () => {
    const result = evaluate(
      "User-agent: *\nDisallow: /admin\nAllow: /admin/public\n",
      "*",
      "/admin/public/page",
    );
    expect(result.result).toBe("allowed");
    expect(result.matchedRule).toMatchObject({ pattern: "/admin/public" });
  });

  it("resolves an equal-length tie in favour of Allow", () => {
    const result = evaluate("User-agent: *\nDisallow: /x\nAllow: /x\n", "*", "/x");
    expect(result.result).toBe("allowed");
  });

  it("supports wildcard (*) within a path pattern", () => {
    const result = evaluate("User-agent: *\nDisallow: /*.pdf\n", "*", "/files/report.pdf");
    expect(result.result).toBe("blocked");
  });

  it("supports end-anchored ($) patterns", () => {
    const result = evaluate("User-agent: *\nDisallow: /file$\n", "*", "/file");
    expect(result.result).toBe("blocked");
  });

  it("does not match an end-anchored pattern against a longer path", () => {
    const result = evaluate("User-agent: *\nDisallow: /file$\n", "*", "/file2");
    expect(result.result).toBe("allowed");
  });

  it("combines rules from duplicate groups for the same token (RFC 9309 §2.2.1)", () => {
    const result = evaluate(
      "User-agent: GPTBot\nDisallow: /a\nUser-agent: GPTBot\nDisallow: /b\n",
      "GPTBot",
      "/b/page",
    );
    expect(result.result).toBe("blocked");
    expect(result.matchedRule).toMatchObject({ pattern: "/b" });
  });

  it("matches user-agent tokens case-insensitively", () => {
    const result = evaluate("User-agent: gptbot\nDisallow: /\n", "GPTBot", "/x");
    expect(result.result).toBe("blocked");
  });

  it("returns no_explicit_rule for an entirely empty robots.txt", () => {
    const result = evaluate("", "GPTBot", "/x");
    expect(result.result).toBe("no_explicit_rule");
  });

  it("includes a plain-language explanation in every trace", () => {
    const result = evaluate("User-agent: *\nDisallow: /admin\n", "*", "/admin");
    expect(result.explanation.length).toBeGreaterThan(0);
  });
});
