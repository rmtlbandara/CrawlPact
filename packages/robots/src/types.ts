/**
 * robots.txt parsing/evaluation types (SRS §16, FR-ROB-001..011). This
 * package is pure and network-free — it operates on already-fetched text.
 * Fetching happens in packages/scanner via the safe-fetch chokepoint.
 */

export type RobotsFieldType =
  "user-agent" | "allow" | "disallow" | "sitemap" | "crawl-delay" | "unknown";

export type RobotsLine =
  | { lineNumber: number; kind: "blank"; raw: string }
  | { lineNumber: number; kind: "comment"; raw: string }
  | {
      lineNumber: number;
      kind: "directive";
      raw: string;
      fieldName: string;
      fieldType: RobotsFieldType;
      value: string;
      isStandard: boolean;
      malformed: boolean;
    };

export type RobotsRule = {
  type: "allow" | "disallow";
  pattern: string;
  anchored: boolean;
  lineNumber: number;
};

export type RobotsGroup = {
  /** As declared, original casing preserved for display. */
  userAgents: string[];
  rules: RobotsRule[];
  startLine: number;
  endLine: number;
};

export type RobotsSitemapEntry = {
  value: string;
  lineNumber: number;
  valid: boolean;
};

export type RobotsIssueCode =
  | "RULE_BEFORE_GROUP"
  | "MALFORMED_DIRECTIVE"
  | "DUPLICATE_GROUP"
  | "BROAD_WILDCARD_BLOCK"
  | "INVALID_SITEMAP"
  | "NON_STANDARD_FIELD"
  | "HTML_RESPONSE"
  | "INVALID_ENCODING"
  | "OVERSIZED_FILE"
  | "EMPTY_FILE";

export type RobotsIssue = {
  code: RobotsIssueCode;
  severity: "info" | "warning" | "error";
  lineNumber?: number;
  message: string;
};

export type ParsedRobots = {
  originalText: string;
  lines: RobotsLine[];
  groups: RobotsGroup[];
  sitemaps: RobotsSitemapEntry[];
  issues: RobotsIssue[];
};

export type RobotsEvaluationResult =
  "allowed" | "blocked" | "no_explicit_rule" | "mixed" | "unknown";

export type RobotsMatchTrace = {
  crawlerToken: string;
  path: string;
  applicableGroupUserAgents: string[] | null;
  matchedRule: RobotsRule | null;
  lineNumber: number | null;
  result: RobotsEvaluationResult;
  explanation: string;
};
