import { describe, expect, it } from "vitest";
import { parseLlmsTxt } from "./llms-txt";
import { parseContentSignals } from "./content-signals";
import { parseHtmlSignals, parseXRobotsTag } from "./html-signals";
import { MAX_SITEMAP_SCAN_BYTES, validateSitemap } from "./sitemap";
import { MAX_RSL_SCAN_BYTES, parseRsl } from "./rsl";

describe("parseLlmsTxt", () => {
  it("recognises a well-formed file", () => {
    const result = parseLlmsTxt("# My Site\n\nSome intro.\n\n- [Docs](https://example.com/docs)\n");
    expect(result.hasH1Heading).toBe(true);
    expect(result.linkedResources).toEqual(["https://example.com/docs"]);
  });

  it("flags a missing top-level heading", () => {
    const result = parseLlmsTxt("Just some text with no heading.\n");
    expect(result.hasH1Heading).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("treats an empty file as informational", () => {
    const result = parseLlmsTxt("");
    expect(result.issues).toContain("The file is empty.");
  });
});

describe("parseContentSignals", () => {
  it("recognises known keys", () => {
    const result = parseContentSignals("search=yes, ai-train=no, ai-input=yes");
    expect(result.recognised).toEqual({ search: "yes", "ai-train": "no", "ai-input": "yes" });
    expect(result.unknownFields).toEqual({});
  });

  it("preserves unknown fields rather than discarding them", () => {
    const result = parseContentSignals("search=yes, future-field=maybe");
    expect(result.unknownFields).toEqual({ "future-field": "maybe" });
  });

  it("marks an unrecognised value as unknown, not a crash", () => {
    const result = parseContentSignals("search=sometimes");
    expect(result.recognised.search).toBe("unknown");
  });
});

describe("parseHtmlSignals", () => {
  it("extracts meta robots and canonical", () => {
    const html = `<html><head><meta name="robots" content="noindex, nofollow"><link rel="canonical" href="https://example.com/page"></head></html>`;
    const result = parseHtmlSignals(html);
    expect(result.metaRobots).toBe("noindex, nofollow");
    expect(result.canonicalUrl).toBe("https://example.com/page");
  });

  it("returns nulls when nothing is present", () => {
    const result = parseHtmlSignals("<html><head></head><body>hi</body></html>");
    expect(result.metaRobots).toBeNull();
    expect(result.canonicalUrl).toBeNull();
  });

  it("parses X-Robots-Tag header values", () => {
    expect(parseXRobotsTag("noindex, nofollow")).toEqual(["noindex", "nofollow"]);
    expect(parseXRobotsTag(null)).toEqual([]);
  });
});

describe("validateSitemap", () => {
  it("recognises a urlset sitemap and samples URLs", () => {
    const xml = `<?xml version="1.0"?><urlset><url><loc>https://example.com/a</loc></url><url><loc>https://example.com/b</loc></url></urlset>`;
    const result = validateSitemap(xml);
    expect(result.looksLikeSitemap).toBe(true);
    expect(result.sampledUrls).toEqual(["https://example.com/a", "https://example.com/b"]);
  });

  it("recognises a sitemap index", () => {
    const xml = `<sitemapindex><sitemap><loc>https://example.com/sitemap1.xml</loc></sitemap></sitemapindex>`;
    expect(validateSitemap(xml).isIndex).toBe(true);
  });

  it("flags a response that is not a sitemap at all", () => {
    const result = validateSitemap("<html><body>not a sitemap</body></html>");
    expect(result.looksLikeSitemap).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("reports truncated:false for a well-formed document under the bound", () => {
    const xml = `<urlset><url><loc>https://example.com/a</loc></url></urlset>`;
    expect(validateSitemap(xml).truncated).toBe(false);
  });

  it("bounds a document larger than MAX_SITEMAP_SCAN_BYTES, sampling only from the first portion (Phase 11, §13.2)", () => {
    const xml = `<urlset><url><loc>https://example.com/a</loc></url></urlset>${"x".repeat(MAX_SITEMAP_SCAN_BYTES)}`;
    const result = validateSitemap(xml);
    expect(result.truncated).toBe(true);
    expect(result.looksLikeSitemap).toBe(true);
    expect(result.sampledUrls).toEqual(["https://example.com/a"]);
    expect(result.issues.some((issue) => issue.includes("bounded scan limit"))).toBe(true);
  });

  it("does not scan past the bound for <loc> entries that start after it, without crashing", () => {
    const padding = "<!--" + "x".repeat(MAX_SITEMAP_SCAN_BYTES) + "-->";
    const xml = `<urlset>${padding}<url><loc>https://example.com/late</loc></url></urlset>`;
    const result = validateSitemap(xml);
    expect(result.truncated).toBe(true);
    expect(result.sampledUrls).toEqual([]);
    expect(result.issues).toContain("No <loc> entries were found.");
  });

  it("reports truncated:true even on the not-a-sitemap path when input exceeds the bound", () => {
    const xml = "not a sitemap ".repeat(MAX_SITEMAP_SCAN_BYTES);
    const result = validateSitemap(xml);
    expect(result.looksLikeSitemap).toBe(false);
    expect(result.truncated).toBe(true);
  });
});

describe("parseRsl", () => {
  it("returns discovered:false when no license element exists", () => {
    const result = parseRsl("<html></html>");
    expect(result.discovered).toBe(false);
  });

  it("extracts permits/prohibits/payment from a license element", () => {
    const xml = `<license><permits>search</permits><prohibits>ai-train</prohibits><payment>subscription</payment></license>`;
    const result = parseRsl(xml);
    expect(result.discovered).toBe(true);
    expect(result.permits).toEqual(["search"]);
    expect(result.prohibits).toEqual(["ai-train"]);
    expect(result.paymentTerms).toEqual(["subscription"]);
  });

  it("preserves unsupported elements instead of silently dropping them", () => {
    const xml = `<license><permits>search</permits><futureTag>x</futureTag></license>`;
    const result = parseRsl(xml);
    expect(result.unsupportedElements).toContain("futuretag");
  });

  it("reports truncated:false and parses normally for input at or under the bound", () => {
    const xml = `<license><permits>search</permits></license>`;
    const result = parseRsl(xml);
    expect(result.truncated).toBe(false);
    expect(result.issues).toEqual([]);
  });

  it("reports truncated:false for the no-license-found path when input is under the bound", () => {
    const result = parseRsl("<html></html>");
    expect(result.truncated).toBe(false);
  });

  it("bounds a document larger than MAX_RSL_SCAN_BYTES, truncating before parsing and disclosing it (Phase 11, §13.1)", () => {
    const padding = "x".repeat(MAX_RSL_SCAN_BYTES);
    const xml = `<license><permits>search</permits></license>${padding}`;
    const result = parseRsl(xml);
    expect(result.truncated).toBe(true);
    expect(result.discovered).toBe(true);
    expect(result.issues.some((issue) => issue.includes("bounded scan limit"))).toBe(true);
  });

  it("still finds a <license> element that starts within the bound even when the overall document is oversized", () => {
    const xml = `<license><permits>search</permits><prohibits>ai-train</prohibits></license>${"x".repeat(MAX_RSL_SCAN_BYTES)}`;
    const result = parseRsl(xml);
    expect(result.discovered).toBe(true);
    expect(result.permits).toEqual(["search"]);
    expect(result.prohibits).toEqual(["ai-train"]);
  });

  it("reports truncated:true even on the no-license-found path when input exceeds the bound", () => {
    const xml = "x".repeat(MAX_RSL_SCAN_BYTES + 1);
    const result = parseRsl(xml);
    expect(result.discovered).toBe(false);
    expect(result.truncated).toBe(true);
  });
});
