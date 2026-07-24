/**
 * Bounded HTML/HTTP signal extraction (SRS §19.4). Deliberately regex-based
 * rather than a full DOM parser — this only needs to pull a handful of
 * well-known tags out of an already-size-bounded HTML document, and adding
 * a DOM/HTML parsing dependency for that would be disproportionate (ADR-0003
 * spirit: minimal dependencies for a solo founder). Never used to execute
 * or interpret the page in any other way.
 */
export type HtmlSignals = {
  metaRobots: string | null;
  canonicalUrl: string | null;
  policyReferenceLinks: string[];
};

function extractAttr(tag: string, attr: string): string | null {
  const pattern = new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, "i");
  const match = pattern.exec(tag);
  return match ? match[1]! : null;
}

const MAX_HTML_SCAN_BYTES = 200_000;

export function parseHtmlSignals(html: string): HtmlSignals {
  const bounded = html.slice(0, MAX_HTML_SCAN_BYTES);

  let metaRobots: string | null = null;
  const metaTagPattern = /<meta\s+[^>]*>/gi;
  let metaMatch: RegExpExecArray | null;
  while ((metaMatch = metaTagPattern.exec(bounded)) !== null) {
    const tag = metaMatch[0];
    if (/name\s*=\s*["']robots["']/i.test(tag)) {
      metaRobots = extractAttr(tag, "content");
      break;
    }
  }

  let canonicalUrl: string | null = null;
  const linkTagPattern = /<link\s+[^>]*>/gi;
  let linkMatch: RegExpExecArray | null;
  const policyReferenceLinks: string[] = [];
  while ((linkMatch = linkTagPattern.exec(bounded)) !== null) {
    const tag = linkMatch[0];
    if (/rel\s*=\s*["']canonical["']/i.test(tag) && !canonicalUrl) {
      canonicalUrl = extractAttr(tag, "href");
    }
    if (/rel\s*=\s*["']license["']/i.test(tag)) {
      const href = extractAttr(tag, "href");
      if (href) policyReferenceLinks.push(href);
    }
  }

  return { metaRobots, canonicalUrl, policyReferenceLinks };
}

/** X-Robots-Tag is an HTTP header, not HTML — parsed directly from its value. */
export function parseXRobotsTag(headerValue: string | null): string[] {
  if (!headerValue) return [];
  return headerValue
    .split(",")
    .map((directive) => directive.trim())
    .filter((directive) => directive.length > 0);
}
