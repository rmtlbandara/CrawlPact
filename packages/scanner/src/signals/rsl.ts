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
};

const KNOWN_ELEMENTS = new Set(["license", "permits", "prohibits", "payment", "copyright"]);

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
  const issues: string[] = [];
  const hasLicenseElement = /<license[\s>]/i.test(xmlText);

  if (!hasLicenseElement) {
    return {
      discovered: false,
      permits: [],
      prohibits: [],
      paymentTerms: [],
      unsupportedElements: [],
      issues: ["No RSL <license> element was found."],
    };
  }

  const allTags = extractTagNames(xmlText);
  const unsupportedElements = allTags.filter((tag) => !KNOWN_ELEMENTS.has(tag));

  return {
    discovered: true,
    permits: extractElementTextValues(xmlText, "permits"),
    prohibits: extractElementTextValues(xmlText, "prohibits"),
    paymentTerms: extractElementTextValues(xmlText, "payment"),
    unsupportedElements,
    issues,
  };
}
