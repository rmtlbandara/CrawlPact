/**
 * Bounded sitemap validation (SRS §19.5). Validates basic accessibility and
 * format only — never crawls every declared URL, only samples a bounded
 * number for informational purposes.
 */
export type SitemapValidation = {
  looksLikeSitemap: boolean;
  isIndex: boolean;
  sampledUrls: string[];
  issues: string[];
  /** Phase 11 (§13.2): true if the input exceeded MAX_SITEMAP_SCAN_BYTES and
   * was cut before the <loc> regex scan ran. The old MAX_SAMPLE_URLS cap only
   * bounds output size — a sparse or malformed sitemap (few/no matching
   * <loc> entries) could still force the regex to walk the entire fetched
   * body, up to safe-fetch's 2 MiB ceiling, before giving up. This is a
   * dedicated pre-parse bound on the input itself, matching the pattern
   * already used for robots.txt (512,000 bytes), HTML (200,000 bytes) and
   * RSL (200,000 bytes). */
  truncated: boolean;
};

const MAX_SAMPLE_URLS = 10;

/** Phase 11 (§13.2): pre-parse bound for the <loc> regex scan below. Sample
 * URLs are typically declared early in a sitemap, so 200,000 bytes is ample
 * to find MAX_SAMPLE_URLS entries in a well-formed file while preventing a
 * worst-case full scan of a large or adversarial document. */
export const MAX_SITEMAP_SCAN_BYTES = 200_000;

export function validateSitemap(xmlText: string): SitemapValidation {
  const issues: string[] = [];
  const truncated = xmlText.length > MAX_SITEMAP_SCAN_BYTES;
  const trimmed = xmlText.slice(0, MAX_SITEMAP_SCAN_BYTES).trim();

  const isIndex = /<sitemapindex[\s>]/i.test(trimmed);
  const isUrlset = /<urlset[\s>]/i.test(trimmed);
  const looksLikeSitemap = isIndex || isUrlset;

  if (!looksLikeSitemap) {
    issues.push("The response does not contain a recognisable <urlset> or <sitemapindex> element.");
    return { looksLikeSitemap: false, isIndex: false, sampledUrls: [], issues, truncated };
  }

  const locPattern = /<loc>\s*([^<\s][^<]*?)\s*<\/loc>/gi;
  const sampledUrls: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = locPattern.exec(trimmed)) !== null && sampledUrls.length < MAX_SAMPLE_URLS) {
    sampledUrls.push(match[1]!.trim());
  }

  if (sampledUrls.length === 0) {
    issues.push("No <loc> entries were found.");
  }

  if (truncated) {
    issues.push(
      "This document was larger than the bounded scan limit — analysis reflects only the first portion.",
    );
  }

  return { looksLikeSitemap, isIndex, sampledUrls, issues, truncated };
}
