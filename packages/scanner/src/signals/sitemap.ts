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
};

const MAX_SAMPLE_URLS = 10;

export function validateSitemap(xmlText: string): SitemapValidation {
  const issues: string[] = [];
  const trimmed = xmlText.trim();

  const isIndex = /<sitemapindex[\s>]/i.test(trimmed);
  const isUrlset = /<urlset[\s>]/i.test(trimmed);
  const looksLikeSitemap = isIndex || isUrlset;

  if (!looksLikeSitemap) {
    issues.push("The response does not contain a recognisable <urlset> or <sitemapindex> element.");
    return { looksLikeSitemap: false, isIndex: false, sampledUrls: [], issues };
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

  return { looksLikeSitemap, isIndex, sampledUrls, issues };
}
