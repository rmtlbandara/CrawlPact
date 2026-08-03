import { describe, expect, it } from "vitest";
import { BRAND } from "./brand";

describe("BRAND canonical values", () => {
  it("has the canonical product name, tagline, and brand promise", () => {
    expect(BRAND.productName).toBe("CrawlPact");
    expect(BRAND.tagline).toBe("AI crawler policy, verified.");
    expect(BRAND.brandPromise).toBe(
      "Know what your website tells AI crawlers — and when it changes.",
    );
  });

  it("does not contain the stale, superseded tagline", () => {
    const values = JSON.stringify(BRAND);
    expect(values.toLowerCase()).not.toContain("know what ai crawlers can access");
  });

  it("does not contain any prohibited claim from docs/brand/CLAIMS_AND_MESSAGING_GUIDE.md", () => {
    const values = JSON.stringify(BRAND).toLowerCase();
    const prohibited = [
      "stops all ai scraping",
      "makes crawlers obey",
      "guarantees ai visibility",
      "guarantees search inclusion",
      "guarantees training exclusion",
      "protects all website content",
      "proves what every crawler accessed",
      "legal compliance certification",
      "complete ai compliance",
      "replaces a waf",
      "monitors actual traffic without log access",
      "supports every crawler",
    ];
    for (const phrase of prohibited) {
      expect(values).not.toContain(phrase);
    }
  });

  it("states the approved boundary and standard disclaimers without contradicting them", () => {
    expect(BRAND.approvedBoundaryStatement).toContain("does not control external crawlers");
    expect(BRAND.standardReportDisclaimer).toContain("do not guarantee external crawler behaviour");
  });

  it("uses consistent product naming (no two-word or miscased variants)", () => {
    const values = JSON.stringify(BRAND);
    expect(values).not.toMatch(/\bCrawl Pact\b/);
    expect(values).not.toMatch(/\bClawPact\b/);
  });
});
