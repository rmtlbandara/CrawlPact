import { describe, expect, it } from "vitest";
import { parseLlmsTxt } from "./llms-txt";
import { parseContentSignals } from "./content-signals";
import { parseHtmlSignals, parseXRobotsTag } from "./html-signals";
import { validateSitemap } from "./sitemap";
import { parseRsl } from "./rsl";

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
});
