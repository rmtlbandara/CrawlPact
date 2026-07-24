import { describe, expect, it } from "vitest";
import { evaluateAlignment } from "./presets";

describe("evaluateAlignment", () => {
  it("maximum_ai_visibility: blocking a search crawler is misaligned", () => {
    expect(evaluateAlignment("maximum_ai_visibility", "search", "blocked")).toBe("misaligned");
  });

  it("maximum_ai_visibility: allowing training is aligned", () => {
    expect(evaluateAlignment("maximum_ai_visibility", "training", "allowed")).toBe("aligned");
  });

  it("allow_search_block_training: allowing search is aligned", () => {
    expect(evaluateAlignment("allow_search_block_training", "search", "allowed")).toBe("aligned");
  });

  it("allow_search_block_training: allowing training is misaligned", () => {
    expect(evaluateAlignment("allow_search_block_training", "training", "allowed")).toBe(
      "misaligned",
    );
  });

  it("allow_search_block_training: blocking search is misaligned", () => {
    expect(evaluateAlignment("allow_search_block_training", "search", "blocked")).toBe(
      "misaligned",
    );
  });

  it("allow_search_block_training: no_explicit_rule on training needs review", () => {
    expect(evaluateAlignment("allow_search_block_training", "training", "no_explicit_rule")).toBe(
      "review_needed",
    );
  });

  it("publisher_protection: an explicit block or allow on search is aligned either way", () => {
    expect(evaluateAlignment("publisher_protection", "search", "allowed")).toBe("aligned");
    expect(evaluateAlignment("publisher_protection", "search", "blocked")).toBe("aligned");
  });

  it("publisher_protection: no_explicit_rule always needs review", () => {
    expect(evaluateAlignment("publisher_protection", "search", "no_explicit_rule")).toBe(
      "review_needed",
    );
  });

  it("publisher_protection: training must be blocked", () => {
    expect(evaluateAlignment("publisher_protection", "training", "allowed")).toBe("misaligned");
  });

  it("block_known_ai_crawlers: allowing anything is misaligned", () => {
    expect(evaluateAlignment("block_known_ai_crawlers", "user_triggered", "allowed")).toBe(
      "misaligned",
    );
  });

  it("block_known_ai_crawlers: blocking is aligned", () => {
    expect(evaluateAlignment("block_known_ai_crawlers", "agent", "blocked")).toBe("aligned");
  });

  it("returns not_applicable where the preset has no expectation for a purpose", () => {
    expect(evaluateAlignment("maximum_ai_visibility", "unknown", "blocked")).toBe("not_applicable");
  });

  it("treats resource_unavailable and unknown results as review_needed, not misaligned", () => {
    expect(evaluateAlignment("block_known_ai_crawlers", "training", "resource_unavailable")).toBe(
      "review_needed",
    );
    expect(evaluateAlignment("block_known_ai_crawlers", "training", "unknown")).toBe(
      "review_needed",
    );
  });
});
