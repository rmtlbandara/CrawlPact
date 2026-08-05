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

export const MAX_HTML_SCAN_BYTES = 200_000;

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

/**
 * Phase 11 (§ storage reduction, RISK-007): the persisted evidence shape for
 * an `html_meta` scan_resources row. Previously that row stored up to
 * 100,000 bytes of the raw homepage HTML even though only `HtmlSignals`
 * (three small extracted fields) is ever read back out of it — the measured
 * production average was 53,554 bytes/row. This shape stores only the
 * extracted signals, a short bounded snippet for manual evidence review, and
 * enough metadata to know how the row was produced.
 *
 * `format` is a version marker, not just documentation: get-scan-report.ts
 * checks it to tell a new minimised row apart from an old raw-HTML row
 * written before this phase, so already-persisted rows stay readable without
 * a destructive rewrite (see isHtmlMetaEvidence below).
 */
export const HTML_META_EVIDENCE_FORMAT = "html_meta_evidence_v1" as const;
export const HTML_META_PARSER_VERSION = 1;
const MAX_HTML_EVIDENCE_SNIPPET_BYTES = 2_000;

export type HtmlMetaEvidence = HtmlSignals & {
  format: typeof HTML_META_EVIDENCE_FORMAT;
  parserVersion: number;
  /** True if the original fetched HTML exceeded MAX_HTML_SCAN_BYTES and was
   * cut before signal extraction ran — distinct from scan_resources.truncated,
   * which reflects safe-fetch's own 2 MiB fetch-level cap. */
  truncated: boolean;
  /** Bounded raw excerpt kept for manual evidence review — deliberately much
   * smaller than the old full-body capture. */
  snippet: string;
};

export function buildHtmlMetaEvidence(html: string): HtmlMetaEvidence {
  const signals = parseHtmlSignals(html);
  return {
    ...signals,
    format: HTML_META_EVIDENCE_FORMAT,
    parserVersion: HTML_META_PARSER_VERSION,
    truncated: html.length > MAX_HTML_SCAN_BYTES,
    snippet: html.slice(0, MAX_HTML_EVIDENCE_SNIPPET_BYTES),
  };
}

export function isHtmlMetaEvidence(value: unknown): value is HtmlMetaEvidence {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { format?: unknown }).format === HTML_META_EVIDENCE_FORMAT
  );
}

/** X-Robots-Tag is an HTTP header, not HTML — parsed directly from its value. */
export function parseXRobotsTag(headerValue: string | null): string[] {
  if (!headerValue) return [];
  return headerValue
    .split(",")
    .map((directive) => directive.trim())
    .filter((directive) => directive.length > 0);
}
