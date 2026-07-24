import { describe, expect, it } from "vitest";
import { parseRobotsTxt } from "./parser";

describe("parseRobotsTxt", () => {
  it("parses a simple single-group file", () => {
    const result = parseRobotsTxt("User-agent: *\nDisallow: /admin\nAllow: /admin/public\n");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]!.userAgents).toEqual(["*"]);
    expect(result.groups[0]!.rules).toEqual([
      { type: "disallow", pattern: "/admin", anchored: false, lineNumber: 2 },
      { type: "allow", pattern: "/admin/public", anchored: false, lineNumber: 3 },
    ]);
  });

  it("preserves original text, comments, and blank lines", () => {
    const text = "# comment\n\nUser-agent: *\nDisallow: /\n";
    const result = parseRobotsTxt(text);
    expect(result.originalText).toBe(text);
    expect(result.lines[0]).toMatchObject({ kind: "comment" });
    expect(result.lines[1]).toMatchObject({ kind: "blank" });
  });

  it("groups consecutive User-agent lines into one group", () => {
    const result = parseRobotsTxt("User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\n");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]!.userAgents).toEqual(["GPTBot", "ClaudeBot"]);
  });

  it("starts a new group when User-agent follows a rule", () => {
    const result = parseRobotsTxt(
      "User-agent: GPTBot\nDisallow: /\nUser-agent: ClaudeBot\nDisallow: /private\n",
    );
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0]!.userAgents).toEqual(["GPTBot"]);
    expect(result.groups[1]!.userAgents).toEqual(["ClaudeBot"]);
  });

  it("recognises Sitemap directives anywhere in the file", () => {
    const result = parseRobotsTxt(
      "Sitemap: https://example.com/sitemap.xml\nUser-agent: *\nDisallow:\n",
    );
    expect(result.sitemaps).toEqual([
      { value: "https://example.com/sitemap.xml", lineNumber: 1, valid: true },
    ]);
  });

  it("flags an invalid sitemap value", () => {
    const result = parseRobotsTxt("Sitemap: not-a-url\n");
    expect(result.sitemaps[0]).toMatchObject({ valid: false });
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "INVALID_SITEMAP" }));
  });

  it("preserves and flags non-standard fields", () => {
    const result = parseRobotsTxt("User-agent: *\nCustom-Field: hello\nDisallow: /\n");
    expect(result.lines[1]).toMatchObject({ fieldName: "Custom-Field", fieldType: "unknown" });
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "NON_STANDARD_FIELD" }));
  });

  it("recognises Crawl-delay as non-standard-but-known and does not flag it as unknown", () => {
    const result = parseRobotsTxt("User-agent: *\nCrawl-delay: 10\nDisallow: /\n");
    expect(result.lines[1]).toMatchObject({ fieldType: "crawl-delay" });
    expect(result.issues.some((i) => i.code === "NON_STANDARD_FIELD")).toBe(false);
  });

  it("flags a malformed directive with no colon", () => {
    const result = parseRobotsTxt("User-agent *\n");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "MALFORMED_DIRECTIVE" }));
  });

  it("flags a rule declared before any User-agent group", () => {
    const result = parseRobotsTxt("Disallow: /\nUser-agent: *\n");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "RULE_BEFORE_GROUP" }));
    expect(result.groups[0]!.rules).toHaveLength(0);
  });

  it("detects duplicate groups for the same token", () => {
    const result = parseRobotsTxt(
      "User-agent: GPTBot\nDisallow: /a\nUser-agent: GPTBot\nDisallow: /b\n",
    );
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "DUPLICATE_GROUP" }));
  });

  it("detects a broad wildcard block", () => {
    const result = parseRobotsTxt("User-agent: *\nDisallow: /\n");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "BROAD_WILDCARD_BLOCK" }));
  });

  it("does not flag a scoped disallow as a broad wildcard block", () => {
    const result = parseRobotsTxt("User-agent: *\nDisallow: /admin\n");
    expect(result.issues.some((i) => i.code === "BROAD_WILDCARD_BLOCK")).toBe(false);
  });

  it("treats an empty file as informational, not an error", () => {
    const result = parseRobotsTxt("");
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "EMPTY_FILE", severity: "info" }),
    ]);
  });

  it("detects an HTML response returned as robots.txt", () => {
    const result = parseRobotsTxt("<!DOCTYPE html><html><body>404</body></html>");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "HTML_RESPONSE" }));
  });

  it("detects invalid encoding (replacement characters)", () => {
    const result = parseRobotsTxt("User-agent: *\n��Disallow: /\n");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "INVALID_ENCODING" }));
  });

  it("bounds an oversized file and flags it", () => {
    const huge = "User-agent: *\n" + "Disallow: /x\n".repeat(100);
    const result = parseRobotsTxt(huge, 50);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "OVERSIZED_FILE" }));
    expect(result.originalText.length).toBe(huge.length); // original preserved even though evaluation is bounded
  });

  it("handles inline comments after a directive", () => {
    const result = parseRobotsTxt("User-agent: *\nDisallow: /admin # keep private\n");
    expect(result.groups[0]!.rules[0]).toMatchObject({ pattern: "/admin" });
  });

  it("handles CRLF line endings", () => {
    const result = parseRobotsTxt("User-agent: *\r\nDisallow: /\r\n");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]!.rules).toHaveLength(1);
  });

  it("strips a leading UTF-8 BOM on the first line", () => {
    const result = parseRobotsTxt("﻿User-agent: *\nDisallow: /\n");
    expect(result.groups[0]!.userAgents).toEqual(["*"]);
  });

  it("parses an end-anchored rule", () => {
    const result = parseRobotsTxt("User-agent: *\nDisallow: /file.php$\n");
    expect(result.groups[0]!.rules[0]).toMatchObject({ pattern: "/file.php", anchored: true });
  });

  it("handles an empty Disallow value as allow-all for that group", () => {
    const result = parseRobotsTxt("User-agent: *\nDisallow:\n");
    expect(result.groups[0]!.rules).toHaveLength(1);
    expect(result.groups[0]!.rules[0]).toMatchObject({ pattern: "" });
  });
});
