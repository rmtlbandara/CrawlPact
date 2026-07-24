import type {
  ParsedRobots,
  RobotsFieldType,
  RobotsGroup,
  RobotsIssue,
  RobotsLine,
  RobotsSitemapEntry,
} from "./types";

const KNOWN_FIELDS: Record<string, RobotsFieldType> = {
  "user-agent": "user-agent",
  allow: "allow",
  disallow: "disallow",
  sitemap: "sitemap",
  "crawl-delay": "crawl-delay",
};

const STANDARD_FIELDS = new Set<RobotsFieldType>(["user-agent", "allow", "disallow", "sitemap"]);

function isValidAbsoluteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseLine(rawLine: string, lineNumber: number): RobotsLine {
  const withoutBom = lineNumber === 1 ? rawLine.replace(/^\uFEFF/, "") : rawLine;
  const trimmed = withoutBom.trim();

  if (trimmed.length === 0) {
    return { lineNumber, kind: "blank", raw: rawLine };
  }
  if (trimmed.startsWith("#")) {
    return { lineNumber, kind: "comment", raw: rawLine };
  }

  // Strip an inline comment (a `#` not inside the field value's meaningful
  // content — robots.txt has no quoting, so a bare `#` anywhere ends the line).
  const hashIndex = trimmed.indexOf("#");
  const content = hashIndex >= 0 ? trimmed.slice(0, hashIndex).trim() : trimmed;

  const colonIndex = content.indexOf(":");
  if (colonIndex < 0) {
    return {
      lineNumber,
      kind: "directive",
      raw: rawLine,
      fieldName: content,
      fieldType: "unknown",
      value: "",
      isStandard: false,
      malformed: true,
    };
  }

  const fieldName = content.slice(0, colonIndex).trim();
  const value = content.slice(colonIndex + 1).trim();
  const fieldType = KNOWN_FIELDS[fieldName.toLowerCase()] ?? "unknown";
  const isStandard = STANDARD_FIELDS.has(fieldType);

  return {
    lineNumber,
    kind: "directive",
    raw: rawLine,
    fieldName,
    fieldType,
    value,
    isStandard,
    // An empty value is valid syntax for Allow/Disallow (means "no
    // restriction") and is only genuinely malformed for fields that
    // require a value, i.e. everything except allow/disallow.
    malformed: value.length === 0 && fieldType !== "allow" && fieldType !== "disallow",
  };
}

/**
 * Parses robots.txt text into lines, groups, sitemaps, and issues, preserving
 * everything needed for an evidence trail (SRS FR-ROB-003): original text,
 * line numbers, comments, blank lines, and unknown/non-standard fields.
 *
 * Grouping follows RFC 9309 §2.1: one or more consecutive `User-agent` lines
 * form a group's agent set; the group ends when a rule-bearing line is
 * followed by another `User-agent` line (which starts a new group).
 */
export function parseRobotsTxt(originalText: string, maxBytes = 512_000): ParsedRobots {
  const issues: RobotsIssue[] = [];

  if (originalText.length === 0) {
    issues.push({ code: "EMPTY_FILE", severity: "info", message: "The robots.txt file is empty." });
    return { originalText, lines: [], groups: [], sitemaps: [], issues };
  }

  if (originalText.length > maxBytes) {
    issues.push({
      code: "OVERSIZED_FILE",
      severity: "warning",
      message: `robots.txt exceeds the ${maxBytes}-byte bounded read limit; evaluation uses only the first ${maxBytes} bytes.`,
    });
  }

  const bounded = originalText.slice(0, maxBytes);

  const trimmedStart = bounded.trimStart().toLowerCase();
  if (trimmedStart.startsWith("<!doctype html") || trimmedStart.startsWith("<html")) {
    issues.push({
      code: "HTML_RESPONSE",
      severity: "error",
      message: "The response body looks like an HTML page, not a robots.txt file.",
    });
  }

  if (bounded.includes("�")) {
    issues.push({
      code: "INVALID_ENCODING",
      severity: "warning",
      message:
        "The file contains invalid/undecodable byte sequences (replacement characters found).",
    });
  }

  const rawLines = bounded.split(/\r\n|\r|\n/);
  const lines: RobotsLine[] = rawLines.map((raw, index) => parseLine(raw, index + 1));

  for (const line of lines) {
    if (line.kind === "directive" && line.malformed) {
      issues.push({
        code: "MALFORMED_DIRECTIVE",
        severity: "warning",
        lineNumber: line.lineNumber,
        message: `Line ${line.lineNumber} could not be parsed as a valid "field: value" directive.`,
      });
    }
    if (line.kind === "directive" && !line.isStandard && line.fieldType !== "crawl-delay") {
      issues.push({
        code: "NON_STANDARD_FIELD",
        severity: "info",
        lineNumber: line.lineNumber,
        message: `Line ${line.lineNumber} uses a non-standard field ("${line.fieldName}") and is preserved but not evaluated.`,
      });
    }
  }

  const groups: RobotsGroup[] = [];
  const sitemaps: RobotsSitemapEntry[] = [];
  let currentGroup: RobotsGroup | null = null;
  let groupHasRules = false;

  for (const line of lines) {
    if (line.kind !== "directive") continue;

    if (line.fieldType === "sitemap") {
      const valid = isValidAbsoluteUrl(line.value);
      sitemaps.push({ value: line.value, lineNumber: line.lineNumber, valid });
      if (!valid && line.value.length > 0) {
        issues.push({
          code: "INVALID_SITEMAP",
          severity: "warning",
          lineNumber: line.lineNumber,
          message: `Line ${line.lineNumber} declares a Sitemap value that is not a valid absolute URL: "${line.value}".`,
        });
      }
      continue;
    }

    if (line.fieldType === "user-agent") {
      if (!currentGroup || groupHasRules) {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = {
          userAgents: [],
          rules: [],
          startLine: line.lineNumber,
          endLine: line.lineNumber,
        };
        groupHasRules = false;
      }
      if (line.value.length > 0) currentGroup.userAgents.push(line.value);
      currentGroup.endLine = line.lineNumber;
      continue;
    }

    if (line.fieldType === "allow" || line.fieldType === "disallow") {
      if (!currentGroup || currentGroup.userAgents.length === 0) {
        issues.push({
          code: "RULE_BEFORE_GROUP",
          severity: "warning",
          lineNumber: line.lineNumber,
          message: `Line ${line.lineNumber} declares a rule with no preceding User-agent group; it is ignored during evaluation.`,
        });
        continue;
      }
      const anchored = line.value.endsWith("$");
      const pattern = anchored ? line.value.slice(0, -1) : line.value;
      currentGroup.rules.push({
        type: line.fieldType,
        pattern,
        anchored,
        lineNumber: line.lineNumber,
      });
      currentGroup.endLine = line.lineNumber;
      groupHasRules = true;
      continue;
    }
  }
  if (currentGroup) groups.push(currentGroup);

  // Duplicate-group detection: the same token declared in more than one group.
  const seenTokens = new Map<string, number>();
  for (const group of groups) {
    for (const agent of group.userAgents) {
      const key = agent.toLowerCase();
      seenTokens.set(key, (seenTokens.get(key) ?? 0) + 1);
    }
  }
  for (const [token, count] of seenTokens) {
    if (count > 1) {
      issues.push({
        code: "DUPLICATE_GROUP",
        severity: "info",
        message: `The user-agent token "${token}" appears in ${count} separate groups; their rules are combined during evaluation (RFC 9309 §2.2.1).`,
      });
    }
  }

  // Broad wildcard block detection.
  for (const group of groups) {
    const isWildcard = group.userAgents.some((agent) => agent.trim() === "*");
    const blocksEverything = group.rules.some(
      (rule) => rule.type === "disallow" && !rule.anchored && rule.pattern === "/",
    );
    if (isWildcard && blocksEverything) {
      issues.push({
        code: "BROAD_WILDCARD_BLOCK",
        severity: "warning",
        lineNumber: group.startLine,
        message:
          'The wildcard (*) group disallows "/", blocking every crawler that has no more specific group.',
      });
    }
  }

  return { originalText, lines, groups, sitemaps, issues };
}
