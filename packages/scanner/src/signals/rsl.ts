/**
 * Bounded RSL (Really Simple Licensing) discovery and validation (SRS
 * §19.2). RSL is a machine-readable declaration, never technical
 * enforcement — this module only reports what is declared.
 *
 * BEST-EFFORT NOTICE: RSL is an emerging specification. This parser
 * recognises the commonly-documented `<license>` / `permits` / `prohibits`
 * / `payment` element shape via lenient regex extraction (not a full XML
 * parser, to avoid an XML-parsing dependency for a bounded, best-effort
 * read) and preserves anything it doesn't recognise as an "unsupported
 * element" rather than discarding it. Re-verify element names against the
 * current specification (rslstandard.org) before relying on this for a
 * precision claim.
 */
export type RslDeclaration = {
  discovered: boolean;
  permits: string[];
  prohibits: string[];
  paymentTerms: string[];
  unsupportedElements: string[];
  issues: string[];
  /** Phase 11 (§13.1): true if the input exceeded MAX_RSL_SCAN_BYTES and was
   * cut before parsing — matches html-signals.ts's/robots parser's own
   * pre-parse-bound pattern (§4.3/§13.3), the one resource type that
   * previously had no explicit bound before this phase. */
  truncated: boolean;
};

const KNOWN_ELEMENTS = new Set(["license", "permits", "prohibits", "payment", "copyright"]);

/** Phase 11 (§13.1): the persisted-snapshot cap is already 100,000 bytes
 * (persist-scan.ts) and the fetch cap is 2 MiB (safe-fetch.ts) — this is a
 * dedicated pre-parse bound for the regex extraction below specifically,
 * matching the pattern already used for robots.txt (512,000 bytes) and HTML
 * (200,000 bytes). RSL was previously the one resource type scanned with no
 * bound of its own, forcing a worst-case full-2 MiB regex scan on a large or
 * malformed rsl.xml. */
export const MAX_RSL_SCAN_BYTES = 200_000;

function extractTagNames(xml: string): string[] {
  const pattern = /<([a-zA-Z][\w-]*)[ >/]/g;
  const names = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    names.add(match[1]!.toLowerCase());
  }
  return [...names];
}

function extractElementTextValues(xml: string, tagName: string): string[] {
  const pattern = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, "gi");
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    const value = match[1]!.trim();
    if (value.length > 0) values.push(value);
  }
  return values;
}

export function parseRsl(xmlText: string): RslDeclaration {
  const truncated = xmlText.length > MAX_RSL_SCAN_BYTES;
  const bounded = xmlText.slice(0, MAX_RSL_SCAN_BYTES);
  const issues: string[] = [];
  const hasLicenseElement = /<license[\s>]/i.test(bounded);

  if (!hasLicenseElement) {
    return {
      discovered: false,
      permits: [],
      prohibits: [],
      paymentTerms: [],
      unsupportedElements: [],
      issues: ["No RSL <license> element was found."],
      truncated,
    };
  }

  const allTags = extractTagNames(bounded);
  const unsupportedElements = allTags.filter((tag) => !KNOWN_ELEMENTS.has(tag));

  if (truncated) {
    issues.push(
      "This document was larger than the bounded scan limit — analysis reflects only the first portion.",
    );
  }

  return {
    discovered: true,
    permits: extractElementTextValues(bounded, "permits"),
    prohibits: extractElementTextValues(bounded, "prohibits"),
    paymentTerms: extractElementTextValues(bounded, "payment"),
    unsupportedElements,
    issues,
    truncated,
  };
}
